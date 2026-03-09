const { getOrderModel } = require("../../models/users-core/order.models");
const Order = getOrderModel();
const { getUserModel } = require("../../models/users-core/users.models");
const User = getUserModel();
const asyncHandler = require("express-async-handler");
const { getIo } = require("../../socket");
const emailService = require("../util/sendGemail");
const NotificationService = require("../../Notification/notificationService");
const {
  calculateCommission,
  addCommissionDebt,
  calculateCancellationFee,
  shouldApplyCancellationFee,
  handleCancellationPenalty,
} = require("../util/paymentUtils");
const { areTripsConflicting, restoreConflicts } = require("../util/tripUtils");

/**
 * @desc    الحصول على الطلبات لمقدمي الخدمة (مرتبة حسب القرب)
 * @route   GET /api/orders/provider
 * @access  خاص (provider roles: doctor, nursing)
 */
exports.getOrdersForProvider = asyncHandler(async (req, res) => {
  try {
    const { medicalServiceType } = req.query;
    const { location } = req.user;

    if (!location || !location.coordinates || location.coordinates.length < 2) {
      return res
        .status(400)
        .json({ message: "User location is not specified" });
    }

    // Get confirmed orders to avoid conflicts
    const confirmedOrders = await Order.find({
      provider: req.user._id,
      status: "confirmed",
    }).select("appointmentDate duration");

    const excludedDates = confirmedOrders.map(
      (order) => new Date(order.appointmentDate).toISOString().split("T")[0],
    );

    let distance = 50000;
    const MAX_DISTANCE = 2000000;
    let orders = [];

    const query = {
      serviceType: "with_provider",
      status: { $in: ["open", "bidding"] },
      medicalServiceType: medicalServiceType || req.user.role,
    };

    while (distance <= MAX_DISTANCE && orders.length === 0) {
      orders = await Order.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [location.coordinates[0], location.coordinates[1]],
            },
            distanceField: "distance",
            spherical: true,
            maxDistance: distance,
            query: query,
          },
        },
        {
          $addFields: {
            orderDay: {
              $dateToString: { format: "%Y-%m-%d", date: "$appointmentDate" },
            },
          },
        },
        {
          $match: {
            orderDay: { $nin: excludedDates },
          },
        },
        { $sort: { distance: 1 } },
      ]);

      if (orders.length === 0) {
        distance *= 2;
      }
    }

    if (!orders.length) {
      return res.status(404).json({
        message: "There are no applications available in the geographic area.",
      });
    }

    const populatedOrders = await User.populate(orders, {
      path: "patient",
      select: "username avatar _id",
    });

    res.status(200).json({
      message: `Found ${orders.length} orders within the range ${distance / 1000} km`,
      orders: populatedOrders,
    });
  } catch (error) {
    console.error("Error fetching orders for provider:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/**
 * @desc    التقديم علي الطلب
 * @route   PATCH /api/orders/:id/accept
 * @access  خاص (Medical Provider)
 */
exports.acceptOrder = asyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order || (order.status !== "open" && order.status !== "bidding")) {
      return res.status(404).json({ message: "Order not found or not open for applications" });
    }

    if (!["doctor", "nursing", "pharmacy", "hospital"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only medical providers can accept orders" });
    }

    // Check for conflicting confirmed orders
    const confirmedOrders = await Order.find({
      provider: req.user._id,
      status: "confirmed",
    });

    const hasConflict = confirmedOrders.some((confirmed) =>
      areTripsConflicting(
        confirmed.appointmentDate,
        confirmed.duration,
        order.appointmentDate,
        order.duration,
      ),
    );

    if (hasConflict) {
      return res
        .status(400)
        .json({ error: "You have a confirmed appointment at this time" });
    }

    if (order.Interested.length >= 25) {
      return res.status(400).json({ message: "This order already has the maximum number of interested providers" });
    }

    const { proposedPrice, description } = req.body;

    if (proposedPrice) {
      const existingOffer = order.offers.find(
        (o) => o.provider.toString() === req.user._id.toString(),
      );
      if (existingOffer) {
        return res.status(400).json({ message: "You have already submitted an offer for this order" });
      }

      order.offers.push({
        provider: req.user._id,
        proposedPrice: parseFloat(proposedPrice),
        description: description,
        status: "pending",
      });
    }

    if (!order.Interested.includes(req.user._id)) {
      order.Interested.push(req.user._id);
    } else if (!proposedPrice) {
      return res.status(400).json({ message: "You have already expressed interest in this order" });
    }

    await order.save();

    // Socket notification
    const io = getIo();
    if (io) {
      io.to(order.patient.toString()).emit("new_interest", {
        orderId: order._id,
        providerName: req.user.username,
      });
    }

    // Push notification
    try {
      const patientUser = await User.findById(order.patient).select("fcmTokens");
      if (patientUser?.fcmTokens?.length > 0) {
        await NotificationService.sendToMultipleDevices(
          patientUser.fcmTokens,
          "New Medical Provider Interested!",
          `${req.user.username} is interested in your request: ${order.title}`,
          {
            orderId: order._id.toString(),
            type: "provider_interested",
            providerId: req.user._id.toString(),
          },
        );
      }
    } catch (notificationErr) {
      console.error("Error sending push notification:", notificationErr);
    }

    res.status(200).json({ message: "Interest submitted successfully" });
  } catch (error) {
    console.error("Error accepting order:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/**
 * @desc    موافقة الطلب من قبل مقدم الخدمة (إذا تم تعيينه له)
 * @route   PATCH /api/orders/:id/confirm
 * @access  خاص (Medical Provider)
 */
exports.confirmOrder = asyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order || order.status !== "awaiting_provider_confirmation") {
      return res.status(404).json({ message: "Order not found or not awaiting your confirmation" });
    }

    if (order.provider?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not authorized to confirm this order" });
    }

    order.status = "confirmed";
    await order.save();

    // Notify patient
    const io = getIo();
    if (io) {
      io.to(order.patient.toString()).emit("order_confirmed", { orderId: order._id });
    }

    try {
      const patientUser = await User.findById(order.patient).select("fcmTokens email");
      if (patientUser?.fcmTokens?.length > 0) {
        await NotificationService.sendToMultipleDevices(
          patientUser.fcmTokens,
          "Request Confirmed!",
          `Your service request "${order.title}" has been confirmed by the provider.`,
          {
            orderId: order._id.toString(),
            type: "order_confirmed",
          },
        );
      }

      // Email notification
      if (patientUser?.email) {
        const patientEmail = patientUser.email.address || patientUser.email;
        await emailService.sendOrderConfirmation({
          to: patientEmail,
          orderDetails: order.toObject(),
          username: patientUser.username,
        });
      }
    } catch (err) {
      console.error("Error in post-confirmation notifications:", err);
    }

    res.status(200).json({ message: "Order confirmed successfully", order });
  } catch (error) {
    console.error("Error confirming order:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

/**
 * @desc    بدء تقديم الخدمة الطبية
 * @route   PATCH /api/orders/:id/start
 * @access  خاص (Medical Provider)
 */
exports.startService = asyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order || order.status !== "confirmed") {
      return res.status(404).json({ message: "Order not found or not confirmed" });
    }

    if (order.provider?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    order.status = "in_progress";
    await order.save();

    // Notify patient
    const io = getIo();
    if (io) {
      io.to(order.patient.toString()).emit("service_started", { orderId: order._id });
    }

    res.status(200).json({ message: "Service started successfully", order });
  } catch (error) {
    console.error("Error starting service:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @desc    تسجيل وصول مقدم الخدمة للمريض
 * @route   PATCH /api/orders/:id/mark-arrival
 * @access  Private (Medical Provider)
 */
exports.markArrival = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.provider?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    order.completion.providerArrivedAt = new Date();
    await order.save();

    // Notify patient
    const io = getIo();
    if (io) {
      io.to(order.patient.toString()).emit("provider_arrived", { orderId: order._id });
    }

    res.status(200).json({ message: "Arrival recorded successfully", order });
  } catch (error) {
    console.error("Error marking arrival:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @desc    تأكيد إتمام الخدمة الطبية من طرف مقدم الخدمة
 * @route   POST /api/orders/:id/complete
 * @access  خاص (Medical Provider)
 */
exports.completeOrder = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Service request not found" });

    if (order.status !== "in_progress") {
      return res.status(400).json({ message: "Only in-progress services can be marked as complete" });
    }

    if (order.provider?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    order.completion.providerConfirmed = true;
    order.completion.providerConfirmedAt = new Date();
    order.completion.providerFeedback = feedback ? xss(feedback) : "Service delivered";

    // If patient also confirmed, finalize order and deduct 8% commission
    if (order.completion.patientConfirmed) {
      order.status = "completed";
      order.completion.completedAt = new Date();

      const commission = calculateCommission(order.price);
      order.commission = commission;
      await addCommissionDebt(req.user._id, commission);
      order.completion.commissionPaid = true;
    }

    await order.save();

    // Notify patient
    const io = getIo();
    if (io) {
      io.to(order.patient.toString()).emit("provider_confirmed_completion", { orderId: order._id });
    }

    res.status(200).json({
      message: order.status === "completed" ? "Service completed and commission applied" : "Your completion request has been sent to the patient",
      order,
    });
  } catch (err) {
    console.error("Error completing order:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @desc    إلغاء الطلب من قبل مقدم الخدمة مع تطبيق الغرامة إذا تأخر
 * @route   PATCH /api/orders/:id/cancel
 * @access  خاص (Medical Provider)
 */
exports.cancelOrder = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body.reason ? xss(req.body.reason) : "Provider initiated cancellation";

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const uncancelableStatuses = ["completed", "cancelled", "rejected_by_provider"];
    if (uncancelableStatuses.includes(order.status)) {
      return res.status(400).json({ message: "Order cannot be cancelled at this stage" });
    }

    if (order.provider?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Penalty logic
    let feeApplied = false;
    let feeAmount = 0;

    const isLate = shouldApplyCancellationFee(order.appointmentDate);
    const hasPatientArrived = !!order.completion.patientArrivedAt;

    if (order.status === "confirmed" && (isLate || hasPatientArrived)) {
      feeAmount = calculateCancellationFee(order.price);
      // Provider (canceller) pays Patient (damaged)
      await handleCancellationPenalty(req.user._id, feeAmount, order.patient);
      feeApplied = true;
    }

    order.status = "cancelled";
    order.cancellation = {
      cancelledBy: "provider",
      cancelledAt: new Date(),
      reason,
    };

    await order.save();
    await restoreConflicts(req.user._id);

    // Notify patient
    const io = getIo();
    if (io) {
      io.to(order.patient.toString()).emit("order_cancelled_by_provider", {
        orderId: order._id,
        feeApplied,
        feeAmount
      });
    }

    try {
      const patientUser = await User.findById(order.patient).select("fcmTokens");
      if (patientUser?.fcmTokens?.length > 0) {
        await NotificationService.sendToMultipleDevices(
          patientUser.fcmTokens,
          "Service Cancelled by Provider",
          `The provider has cancelled your request "${order.title}"${feeApplied ? ". PENALTY applied: You have been compensated with a fee." : "."}`,
          { orderId: order._id.toString(), type: "order_cancelled" }
        );
      }
    } catch (err) {
      console.error("Error sending cancellation push:", err);
    }

    res.status(200).json({ message: "Order cancelled successfully", feeApplied, feeAmount });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
