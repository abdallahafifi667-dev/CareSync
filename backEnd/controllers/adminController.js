// adminController.js
const { getUserModel } = require("../../models/users-core/users.models");
const Auth = getUserModel();
const Product = require('../../models/E-commerce/products');
const Order = require('../../models/E-commerce/orders');
const Review = require('../../models/E-commerce/Review');
const { category: Category } = require('../../models/plog/category');
const asyncHandler = require('express-async-handler');
const xss = require('xss');
const cloudinary = require("../config/cloudinary");

// Middleware للتحقق من صلاحية الأدمن
const admin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    next();
};

// 1. إدارة المستخدمين --------------------------------------
/**
 * @desc    عرض جميع المستخدمين
 * @route   GET /api/admin/users
 * @access  private/admin
 */
exports.getAllUsers = [admin, asyncHandler(async (req, res) => {
    const users = await Auth.find().select('-password');
    res.status(200).json(users);
})];

/**
 * @desc    حذف مستخدم
 * @route   DELETE /api/admin/users/:id
 * @access  private/admin
 */
exports.deleteUser = [admin, asyncHandler(async (req, res) => {
    const user = await Auth.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // حذف الصور من Cloudinary إذا وجدت
    if (user.PersonalPhoto?.length > 0) {
        const deletePromises = user.PersonalPhoto.map(url => {
            const publicId = url.split('/').pop().split('.')[0];
            return cloudinary.uploader.destroy(`users/${user._id}/documents/${publicId}`);
        });
        await Promise.all(deletePromises);
    }

    res.status(200).json({ message: 'User deleted successfully' });
})];

// 2. إدارة المنتجات -----------------------------------------
/**
 * @desc    حذف منتج
 * @route   DELETE /api/admin/products/:id
 * @access  private/admin
 */
exports.deleteProduct = [admin, asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // حذف الصور من Cloudinary
    const deletePromises = product.imageUrl.map(url => {
        const publicId = url.split('/').pop().split('.')[0];
        return cloudinary.uploader.destroy(`users/${product.author}/products/${publicId}`);
    });
    await Promise.all(deletePromises);

    await Product.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Product deleted successfully' });
})];

// 3. إدارة الطلبات ------------------------------------------
/**
 * @desc    عرض جميع الطلبات
 * @route   GET /api/admin/orders
 * @access  private/admin
 */
exports.getAllOrders = [admin, asyncHandler(async (req, res) => {
    const orders = await Order.find()
        .populate('user', 'username email')
        .populate('ShippingCompany', 'username email');
    res.status(200).json(orders);
})];

/**
 * @desc    تحديث حالة الطلب
 * @route   PUT /api/admin/orders/:id
 * @access  private/admin
 */
exports.updateOrderStatus = [admin, asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findByIdAndUpdate(
        req.params.id,
        { orderStatus: status },
        { new: true }
    );

    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.status(200).json(order);
})];

// 4. إدارة التقييمات ----------------------------------------
/**
 * @desc    حذف تقييم
 * @route   DELETE /api/admin/reviews/:id
 * @access  private/admin
 */
exports.deleteReview = [admin, asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    // تحديث تقييم المنتج
    await updateProductRating(review.product);
    res.status(200).json({ message: 'Review deleted successfully' });
})];

// 5. إدارة الفئات -------------------------------------------
/**
 * @desc    تحديث فئة
 * @route   PUT /api/admin/categories/:id
 * @access  private/admin
 */
exports.updateCategory = [admin, asyncHandler(async (req, res) => {
    const { text, type } = req.body;
    const updateData = {};
    if (text) updateData.text = text;
    if (type) updateData.type = type;

    const category = await Category.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.status(200).json(category);
})];

// دالة مساعدة لتحديث تقييم المنتج
async function updateProductRating(productId) {
    const reviews = await Review.find({ product: productId });
    const total = reviews.reduce((acc, review) => acc + review.rating, 0);
    const avg = reviews.length > 0 ? total / reviews.length : 0;

    await Product.findByIdAndUpdate(productId, {
        avgRating: avg,
        totalRatings: reviews.length
    });
}