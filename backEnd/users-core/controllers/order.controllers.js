const { getOrderModel } = require("../../models/users-core/order.models");
const Order = getOrderModel();
const { getUserModel, getUserWalletModel } = require("../../models/users-core/users.models");
const User = getUserModel();
const { getUserReview } = require("../../models/users-core/Review.models");
const Review = getUserReview();
const asyncHandler = require("express-async-handler");
const xss = require("xss");
const Joi = require("joi");
const {
  validateOrderDataController,
  validateOrderDatasController,
} = require("../validators/OrderValidator");
const { getIo } = require("../../socket");
const NotificationService = require("../../Notification/notificationService");
const {
  calculateCommission,
  addCommissionDebt,
  calculateCancellationFee,
  shouldApplyCancellationFee,
  handleCancellationPenalty,
} = require("../util/paymentUtils");
const { withdrawConflicts, restoreConflicts } = require("../util/tripUtils");

/**
 * @desc    إنشاء طلب خدمة طبية جديد (مفتوح لمقدمين)
 * @route   POST /api/orders
 * @access  Private (patient)
 */
exports.createOrder = asyncHandler(async (req, res) => {
  try {
    const serviceType = xss(req.body.serviceType);
    const medicalServiceType = xss(req.body.medicalServiceType);
    const urgencyLevel = xss(req.body.urgencyLevel) || "normal";

    const meetingPoint = req.body.meetingPoint
      ? {
        type: "Point",
        coordinates: [req.body.meetingPoint.lng, req.body.meetingPoint.lat],
      }
      : null;

    const data = {
      serviceType: serviceType,
      medicalServiceType: medicalServiceType,
      patient: req.user._id,
      title: xss(req.body.title),
      description: xss(req.body.description),
      appointmentDate: xss(req.body.appointmentDate),
      duration: xss(req.body.duration),
      urgencyLevel: urgencyLevel,
      meetingPoint: meetingPoint,
      status: serviceType === "self_service" ? "confirmed" : "open",
      price: parseFloat(req.body.price),
    };

    const { error } = validateOrderDataController(data);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const commission =
      serviceType === "with_provider" ? calculateCommission(data.price) : 0;

    const order = new Order(data);
    order.commission = commission;
    order.paymentStatus = "pending";
    order.paymentMethod = "cash";
    order.payoutStatus = "pending";

    await order.save();

    if (commission > 0) {
      await addCommissionDebt(req.user._id, commission);
    }

    console.log("Medical order created successfully", order._id);
    res.status(201).json({
      message: "Medical service request created successfully",
      orderId: order._id,
      commission: commission,
    });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ error: "An error occurred while creating the service request" });
  }
});

/**
 * @desc    إظهار مقدمي الخدمة الطبية القريبين
 * @route   GET /api/orders/nearby-providers
 * @access  Private (patient)
 */
exports.getNearbyProviders = asyncHandler(async (req, res) => {
  const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  try {
    const location = req.user.location;
    const { medicalServiceType } = req.query; // doctor, nursing, pharmacy, hospital

    if (!location || !location.coordinates) {
      return res
        .status(400)
        .json({ error: "User location is missing or invalid" });
    }

    const rolesFilter = medicalServiceType
      ? [medicalServiceType]
      : ["doctor", "nursing"];

    let distance = 50000;
    let providers = [];
    const MAX_DISTANCE = 150000;

    while (distance <= MAX_DISTANCE && providers.length === 0) {
      providers = await User.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [location.coordinates[0], location.coordinates[1]],
            },
            distanceField: "distance",
            spherical: true,
            maxDistance: distance,
            query: {
              role: { $in: rolesFilter },
              _id: { $ne: req.user._id },
            },
          },
        },
        {
          $project: {
            username: 1,
            avatar: 1,
            description: 1,
            distance: 1,
            role: 1,
            academicDegrees: 1,
          },
        },
      ]);

      if (!providers.length) {
        distance *= 2;
      }
    }

    if (!providers.length) {
      return res.status(404).json({
        message: "No nearby medical providers found",
        providers: [],
      });
    }

    const shuffledProviders = shuffle([...providers]);

    console.log("Found nearby providers:", providers.length);
    res.status(200).json({
      message: `Found ${shuffledProviders.length} providers within ${(distance / 1000).toFixed(1)} km`,
      providers: shuffledProviders,
    });
  } catch (err) {
    console.error("Error fetching nearby providers:", err);
    res.status(500).json({
      error: "An error occurred while fetching nearby providers",
      details: err.message,
    });
  }
});

/**
 * @desc    إنشاء طلب مع تحديد مقدم خدمة معين
 * @route   POST /api/orders/with-provider
 * @access  Private (patient)
 */
exports.createOrderWithProvider = asyncHandler(async (req, res) => {
  try {
    const {
      serviceType,
      medicalServiceType,
      providerId,
      title,
      description,
      appointmentDate,
      duration,
      urgencyLevel,
      meetingPoint,
      price,
    } = req.body;

    if (!providerId || !meetingPoint) {
      return res.status(400).json({
        error: "Missing required fields: providerId or meetingPoint",
      });
    }

    // Validate provider is a medical professional
    const providerUser = await User.findById(providerId).select("role fcmTokens");
    if (!providerUser || !["doctor", "nursing", "pharmacy", "hospital"].includes(providerUser.role)) {
      return res.status(400).json({ error: "Invalid provider: must be a medical professional" });
    }

    const data = {
      serviceType: xss(serviceType) || "with_provider",
      medicalServiceType: xss(medicalServiceType),
      patient: req.user._id,
      provider: xss(providerId),
      title: xss(title),
      description: xss(description),
      appointmentDate: xss(appointmentDate),
      duration: xss(duration),
      urgencyLevel: xss(urgencyLevel) || "normal",
      meetingPoint: {
        type: "Point",
        coordinates: [meetingPoint.lng, meetingPoint.lat],
      },
      status: "awaiting_provider_confirmation",
      price: parseFloat(xss(String(price))),
    };

    const { error } = validateOrderDatasController(data);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const commission = calculateCommission(parseFloat(price));

    const order = new Order(data);
    order.commission = commission;
    order.paymentStatus = "pending";
    order.paymentMethod = "cash";
    order.payoutStatus = "pending";

    await order.save();

    if (commission > 0) {
      await addCommissionDebt(req.user._id, commission);
    }

    try {
      if (providerUser?.fcmTokens?.length > 0) {
        await NotificationService.sendToMultipleDevices(
          providerUser.fcmTokens,
          "New Medical Service Request!",
          `You have a new ${medicalServiceType} request: ${title}`,
          {
            orderId: order._id.toString(),
            type: "new_order",
            medicalServiceType,
          },
        );
      }
    } catch (notificationErr) {
      console.error("Error sending notification:", notificationErr);
    }

    console.log("Order created with specific provider:", order._id);
    res.status(201).json({
      message: "Service request created successfully",
      orderId: order._id,
    });
  } catch (err) {
    console.error("Error creating order with provider:", err);
    res.status(500).json({
      error: "An error occurred while creating the service request",
      details: err.message,
    });
  }
});

/**
 * @desc    جلب طلبات المريض
 * @route   GET /api/orders
 * @access  Private (patient)
 */
exports.getOrders = asyncHandler(async (req, res) => {
  try {
    const { status, page = 1, limit = 10, select, id } = req.query;
    const skip = (page - 1) * limit;

    const filter = { patient: req.user._id };
    if (status) filter.status = status;
    if (id) filter._id = id;

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .select(
          select ||
          "_id title description appointmentDate meetingPoint status price Interested medicalServiceType urgencyLevel",
        )
        .populate({
          path: "Interested",
          select: "username avatar role",
          model: "User",
        })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(filter),
    ]);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No service requests found" });
    }

    console.log("Orders fetched successfully");
    res.status(200).json({
      total: totalOrders,
      currentPage: Number(page),
      totalPages: Math.ceil(totalOrders / limit),
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      error: "An error occurred while fetching service requests",
      details: error.message,
    });
  }
});

/**
 * @desc    إنشاء طلب سريع لحالات الطوارئ (اختيار تلقائي لمقدم الخدمة القريب)
 * @route   POST /api/orders/quick
 * @access  Private (patient)
 */
exports.createQuickOrder = asyncHandler(async (req, res) => {
  const user = req.user;
  const { error } = createQuickOrderValidate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const {
    _id,
    medicalServiceType,
    title,
    description,
    appointmentDate,
    duration,
    location,
    price,
  } = req.body;

  // Search for nearby providers of the requested medical type
  const nearbyProviders = await User.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [location.lng, location.lat] },
        distanceField: "distance",
        spherical: true,
        maxDistance: 50000,
        query: { role: medicalServiceType, _id: { $ne: user._id } },
      },
    },
    { $project: { _id: 1, fcmTokens: 1, username: 1 } },
  ]);

  if (!nearbyProviders.length) {
    return res.status(404).json({
      error: `No ${medicalServiceType}s found near this location for this emergency`,
    });
  }

  // Random selection for emergency
  const selectedProvider =
    nearbyProviders[Math.floor(Math.random() * nearbyProviders.length)];

  const order = await Order.create({
    serviceType: "with_provider",
    medicalServiceType: medicalServiceType,
    patient: _id,
    provider: selectedProvider._id,
    title: xss(title),
    description: xss(description),
    appointmentDate: appointmentDate,
    duration: duration,
    urgencyLevel: "emergency",
    meetingPoint: {
      type: "Point",
      coordinates: [location.lng, location.lat],
    },
    price: price,
    status: "awaiting_provider_confirmation",
    commission: calculateCommission(price),
  });

  if (order.commission > 0) {
    await addCommissionDebt(user._id, order.commission);
  }

  // Notifications
  const io = getIo();
  if (io) {
    io.to(selectedProvider._id.toString()).emit("new_quick_order", {
      orderId: order._id,
      title: order.title,
      patientName: user.username,
    });
  }

  try {
    if (selectedProvider.fcmTokens?.length) {
      await NotificationService.sendToMultipleDevices(
        selectedProvider.fcmTokens,
        "EMERGENCY: New Quick Request!",
        `You have an emergency ${medicalServiceType} request: ${title}`,
        {
          orderId: order._id.toString(),
          type: "new_quick_order",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      );
    }
  } catch (error) {
    console.log("Error sending notification:", error);
  }

  console.log("Emergency quick order created and assigned to a provider");

  res.status(201).json({
    message: `Emergency quick order created and assigned to a ${medicalServiceType}`,
    orderId: order._id,
    providerId: selectedProvider._id,
  });
});

function createQuickOrderValidate(data) {
  const Joi = require("joi");
  const schema = Joi.object({
    _id: Joi.string().required(),
    medicalServiceType: Joi.string().valid("doctor", "nursing", "pharmacy", "hospital").required(),
    title: Joi.string().min(3).required(),
    description: Joi.string().allow(""),
    appointmentDate: Joi.date().required(),
    duration: Joi.number().min(1).required(),
    location: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
    }).required(),
    price: Joi.number().min(0).required(),
  });
  return schema.validate(data);
}

/**
 * @desc    مراجعه المتقدمين
 * @route   get /api/orders/order/:id/review
 * @access  Private (patient)
 */
exports.reviewApplicants = asyncHandler(async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { sortBy } = req.query; // lowest_price, most_experienced, random

  try {
    const order = await Order.findById(id)
      .populate({
        path: "Interested",
        select: "username avatar description location role academicDegrees",
      })
      .lean();

    if (!order) {
      return res.status(404).json({ error: "Service request not found" });
    }

    if (order.status !== "open") {
      return res
        .status(400)
        .json({ error: "This request is not open for review" });
    }

    if (order.patient.toString() !== user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const applicants = [];

    // 1. Interested providers
    for (const provider of order.Interested) {
      const experience = await Order.countDocuments({
        provider: provider._id,
        status: "completed",
      });
      applicants.push({
        ...provider,
        applicantType: "immediate",
        proposedPrice: order.price,
        experience,
        isOffer: false,
      });
    }

    // 2. Providers with custom offers
    for (const offer of order.offers || []) {
      if (offer.status !== "pending") continue;

      const provider = await User.findById(offer.provider)
        .select("username avatar description location role academicDegrees")
        .lean();
      if (!provider) continue;

      const experience = await Order.countDocuments({
        provider: provider._id,
        status: "completed",
      });
      applicants.push({
        ...provider,
        applicantType: "custom_offer",
        proposedPrice: offer.proposedPrice,
        description: offer.description,
        experience,
        isOffer: true,
      });
    }

    // Apply Sorting
    if (sortBy === "lowest_price") {
      applicants.sort((a, b) => a.proposedPrice - b.proposedPrice);
    } else if (sortBy === "most_experienced") {
      applicants.sort((a, b) => b.experience - a.experience);
    } else {
      for (let i = applicants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [applicants[i], applicants[j]] = [applicants[j], applicants[i]];
      }
    }

    console.log("Found applicants:", applicants.length);
    res.status(200).json({
      message: `Found ${applicants.length} applicants`,
      applicants,
    });
  } catch (err) {
    console.error("Error reviewing applicants:", err);
    res.status(500).json({
      error: "An error occurred while reviewing applicants",
    });
  }
});

/**
 * @desc    اختيار مقدم خدمة للطلب
 * @route   POST /api/orders/:id/select-provider
 * @access  Private (patient)
 */
exports.selectProvider = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { providerId } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Service request not found" });
    if (order.status !== "open")
      return res
        .status(400)
        .json({ error: "This request is not open for provider selection" });
    if (order.patient.toString() !== req.user._id.toString())
      return res.status(403).json({
        error: "You are not authorized to select a provider for this request",
      });

    const isProviderInterested = order.Interested.some(
      (p) => p.toString() === providerId,
    );
    if (!isProviderInterested)
      return res
        .status(400)
        .json({ error: "This provider has not accepted your request" });

    order.provider = providerId;
    order.status = "confirmed";
    await order.save();

    await withdrawConflicts(providerId, order);

    const provider = await User.findById(providerId).select("username fcmTokens");

    if (provider?.fcmTokens?.length > 0) {
      try {
        await NotificationService.sendToMultipleDevices(
          provider.fcmTokens,
          "You have been selected!",
          `You have been selected for the service request: ${order.title || "New Request"}`,
          {
            orderId: order._id.toString(),
            type: "provider_accepted",
            requestTitle: order.title || "",
            appointmentDate: order.appointmentDate ? order.appointmentDate.toISOString() : "",
            status: "confirmed",
          },
        );
      } catch (notificationErr) {
        console.error("Error sending acceptance notification:", notificationErr);
      }
    }

    console.log("Provider selected successfully");
    res
      .status(200)
      .json({ message: "Provider selected successfully", orderId: order._id });
  } catch (err) {
    console.error("Error selecting provider:", err);
    res.status(500).json({ error: "An error occurred while selecting provider" });
  }
});

/**
 * @desc    اختيار عرض من العروض المقدمة
 * @route   POST /api/orders/:id/select-offer
 * @access  Private (patient)
 */
exports.selectOffer = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { offerId } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Service request not found" });
    if (order.status !== "open")
      return res.status(400).json({ error: "Request is not open for offer selection" });
    if (order.patient.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Unauthorized" });

    const offer = order.offers.id(offerId);
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    order.provider = offer.provider;
    order.price = offer.proposedPrice;
    order.status = "confirmed";
    order.commission = calculateCommission(offer.proposedPrice);

    offer.status = "accepted";
    order.offers.forEach((o) => {
      if (o._id.toString() !== offerId.toString()) {
        o.status = "rejected";
      }
    });

    await order.save();

    await withdrawConflicts(offer.provider, order);

    const provider = await User.findById(offer.provider).select("fcmTokens");
    if (provider?.fcmTokens?.length > 0) {
      NotificationService.sendToMultipleDevices(
        provider.fcmTokens,
        "Offer Accepted!",
        `Your offer for "${order.title}" has been accepted.`,
      );
    }

    console.log("Offer selected successfully");
    res.status(200).json({ message: "Offer selected successfully", order });
  } catch (err) {
    console.error("Error selecting offer:", err);
    res.status(500).json({
      error: "An error occurred while selecting offer",
      details: err.message,
    });
  }
});

/**
 * @desc    تأكيد إتمام الخدمة الطبية من طرف المريض
 * @route   POST /api/orders/:id/confirm-completion
 * @access  Private (patient)
 */
exports.confirmCompletion = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body; // ✅ ملاحظات المريض عن جودة الخدمة

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Service request not found" });

    if (order.status !== "in_progress") {
      return res.status(400).json({ error: "Only in-progress services can be confirmed" });
    }

    if (order.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    order.completion.patientConfirmed = true;
    order.completion.patientConfirmedAt = new Date();
    order.completion.patientFeedback = feedback ? xss(feedback) : "Good service";

    // If provider also confirmed, finalize order
    if (order.completion.providerConfirmed) {
      order.status = "completed";
      order.completion.completedAt = new Date();

      // Calculate and finalize 8% commission for provider
      const commission = calculateCommission(order.price);
      order.commission = commission;
      await addCommissionDebt(order.provider, commission);
      order.completion.commissionPaid = true;
    }

    await order.save();

    // Notify provider
    const io = getIo();
    if (io && order.provider) {
      io.to(order.provider.toString()).emit("patient_confirmed_completion", { orderId: order._id });
    }

    res.status(200).json({
      message: order.status === "completed" ? "Service completed successfully" : "Your confirmation has been sent",
      order,
    });
  } catch (err) {
    console.error("Error confirming completion:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @desc    تسجيل وصول المريض (إذا كان اللقاء في عيادة/مكان محدد)
 * @route   PATCH /api/orders/:id/mark-arrival
 * @access  Private (patient)
 */
exports.markArrival = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) return res.status(404).json({ error: "Service request not found" });
    if (order.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    order.completion.patientArrivedAt = new Date();
    await order.save();

    // Notify provider
    const io = getIo();
    if (io && order.provider) {
      io.to(order.provider.toString()).emit("patient_arrived", { orderId: order._id });
    }

    res.status(200).json({ message: "Arrival recorded successfully", order });
  } catch (err) {
    console.error("Error marking arrival:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @desc    إلغاء طلب الخدمة الطبية من طرف المريض
 * @route   PATCH /api/orders/:id/cancel
 * @access  Private (patient)
 */
exports.cancelOrder = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body.reason ? xss(req.body.reason) : "Patient initiated cancellation";

    const order = await Order.findById(id).populate("provider");
    if (!order) {
      return res.status(404).json({ error: "Service request not found" });
    }

    const uncancelableStatuses = ["completed", "cancelled", "rejected_by_provider"];
    if (uncancelableStatuses.includes(order.status)) {
      return res.status(400).json({ error: "Service request cannot be cancelled at this stage" });
    }

    if (order.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Penalty logic
    let feeApplied = false;
    let feeAmount = 0;

    // Condition: Late cancellation (within window) OR provider has already arrived
    const isLate = shouldApplyCancellationFee(order.appointmentDate);
    const hasProviderArrived = !!order.completion.providerArrivedAt;

    if (order.provider && (isLate || hasProviderArrived)) {
      feeAmount = calculateCancellationFee(order.price);
      await handleCancellationPenalty(req.user._id, feeAmount, order.provider._id);
      feeApplied = true;
    }

    order.status = "cancelled";
    order.cancellation = {
      cancelledBy: "patient",
      cancelledAt: new Date(),
      reason,
    };

    await order.save();

    if (order.provider) {
      await restoreConflicts(order.provider._id);

      const io = getIo();
      if (io) {
        io.to(order.provider._id.toString()).emit("order_cancelled_by_patient", {
          orderId: order._id,
          feeApplied,
          feeAmount
        });
      }

      try {
        const providerUser = await User.findById(order.provider._id).select("fcmTokens");
        if (providerUser?.fcmTokens?.length > 0) {
          await NotificationService.sendToMultipleDevices(
            providerUser.fcmTokens,
            "Request Cancelled",
            `The service request "${order.title}" has been cancelled by the patient${feeApplied ? ". COMPENSATION: A fee has been added to your balance." : "."}`,
            { orderId: order._id.toString(), type: "order_cancelled" }
          );
        }
      } catch (err) {
        console.error("Error sending cancellation notification:", err);
      }
    }

    res.status(200).json({
      message: "Service request cancelled successfully",
      feeApplied,
      feeAmount,
      orderId: order._id,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
