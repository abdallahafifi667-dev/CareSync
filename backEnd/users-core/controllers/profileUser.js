const asyncHandler = require("express-async-handler");
const xss = require("xss");
const {
  generateTokenAndSend,
} = require("../middlewares/genarattokenandcookies");
const {
  validateProfileUpdate,
  formatValidationErrors: formatProfileValidationErrors,
} = require("../validators/ProfileValidator");
const { getOrderModel } = require("../models/order.models");
const Order = getOrderModel();
const { getUserModel } = require("../models/users.models");
const User = getUserModel();
const { Post, } = require('../../models/plog/post');


if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is not defined. The server cannot start without it.",
  );
}

/**
 * @desc    Get user profile
 * @route   GET /api/user/profile/:id
 * @access  Private
 */
exports.getUserProfile = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password -email");

    if (!user) {
      console.log("User not found");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("getUserProfile");

    res.status(200).json(user);
  } catch (error) {
    console.log(error.message);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});



/**
 * @desc    Get user orders (completed)
 * @route   GET /api/user/orders/completed
 * @access  Private
 */
exports.getUserOrders = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status = "completed" } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [{ patient: userId }, { provider: userId }],
      status: status,
    };

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .populate("patient", "username avatar")
        .populate("provider", "username avatar")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .lean(),
      Order.countDocuments(filter),
    ]);

    if (!orders || orders.length === 0) {
      console.log("No completed orders found");
      return res.status(404).json({ message: "No completed orders found" });
    }

    console.log("Orders retrieved successfully");

    res.status(200).json({
      total: totalOrders,
      currentPage: Number(page),
      totalPages: Math.ceil(totalOrders / limit),
      orders: orders,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @desc get  post
 * @route /api/users/post/:id
 * @method GET
 * @access private 
 */


exports.getPost = asyncHandler(async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(post);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});


/**
 * @desc    Get user order by ID
 * @route   GET /api/user/orders/completed/:id
 * @access  Private
 */
exports.getUserOrderById = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    const order = await Order.findOne({
      _id: orderId,
      $or: [{ patient: userId }, { provider: userId }],
    })
      .populate("patient", "username avatar phone")
      .populate("provider", "username avatar phone")
      .lean();

    if (!order) {
      console.log("Order not found or not accessible");
      return res
        .status(404)
        .json({ message: "Order not found or not accessible" });
    }
    console.log("Order retrieved successfully");

    res.status(200).json(order);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @desc    Get user transportation info
 * @route   GET /api/user/transportation/:id
 * @access  Private
 */
exports.getTransportation = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("transportation");

    if (!user) {
      console.log("User not found");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User transportation info retrieved successfully");
    res.status(200).json({
      transportation: user.transportation || {
        hasVehicle: false,
        vehicleType: "none",
        description: null,
      },
    });
  } catch (error) {
    console.log(error.message);
    res
      .status(500)
      .json({
        message: "Error fetching transportation info",
        error: error.message,
      });
  }
});

/**
 * @desc    Update user transportation info
 * @route   PUT /api/user/transportation/:id
 * @access  Private
 */
exports.updateTransportation = asyncHandler(async (req, res) => {
  try {
    const { hasVehicle, vehicleType, description } = req.body;
    const userId = req.params.id;

    // Validate user authorization
    if (req.user._id.toString() !== userId) {
      console.log("Unauthorized - can only update your own transportation info");
      return res
        .status(403)
        .json({
          message:
            "Unauthorized - can only update your own transportation info",
        });
    }

    // Validate input
    if (hasVehicle && vehicleType) {
      const validVehicleTypes = ["car", "bus", "none"];
      if (!validVehicleTypes.includes(vehicleType)) {
        console.log("Invalid vehicle type");
        return res.status(400).json({
          message: `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(", ")}`,
        });
      }
    }

    // Validate description length if provided
    if (description && description.length > 500) {
      return res
        .status(400)
        .json({ message: "Description cannot exceed 500 characters" });
    }

    const user = await User.findById(userId);

    if (!user) {
      console.log("User not found");
      return res.status(404).json({ message: "User not found" });
    }

    // Update transportation
    user.transportation = {
      hasVehicle: hasVehicle || false,
      vehicleType: hasVehicle ? vehicleType || "none" : "none",
      description: description ? xss(description) : null,
    };

    await user.save();

    console.log("Transportation info updated successfully");
    res.status(200).json({
      message: "Transportation info updated successfully",
      transportation: user.transportation,
    });
  } catch (error) {
    console.log(error.message);
    res
      .status(500)
      .json({
        message: "Error updating transportation info",
        error: error.message,
      });
  }
});


/**
 * @desc    Update user profile
 * @route   PUT /api/user/profile/:id
 * @access  Private
 */
exports.updateUserProfile = asyncHandler(async (req, res) => {
  try {
    let data = {
      phone: xss(req.body.phone),
      description: xss(req.body.description),
      gender: xss(req.body.gender),
    };

    const { error } = validateProfileUpdate(data);
    if (error) {
      console.log("Validation error");
      return res
        .status(400)
        .json({ error: formatProfileValidationErrors(error) });
    }
    if (
      !(
        req.user &&
        (req.user.id === req.params.id || req.user.role === "admin")
      )
    ) {
      console.log("Unauthorized to update profile");
      return res
        .status(403)
        .json({ message: "Unauthorized to update profile" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      console.log("User not found");
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { new: true },
    ).select("-password -email");

    console.log("Profile updated successfully");

    generateTokenAndSend(updatedUser, res);
    res.status(200).json(updatedUser);
  } catch (error) {
    console.log(error.message);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});