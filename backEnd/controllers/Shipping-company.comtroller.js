const Product = require('../../models/E-commerce/products');
const { category: Category } = require('../../models/plog/category');
const Order = require('../../models/E-commerce/orders');
const { getUserModel } = require("../../models/users-core/users.models");
const Auth = getUserModel();
const nodemailer = require('nodemailer');
const asyncHandler = require('express-async-handler');

const shipped = (req, res, next) => {
    if (req.user.role !== 'shipping_company') {
        return res.status(403).json({ message: 'Access denied. Shipping company role required.' });
    }
    next();
}

/**
 * * @desc get all  orders than shipped
 * * @route /api/orders/shipped
 * * @method get
 */
exports.getShippedOrders = [shipped, asyncHandler(async (req, res) => {
    try {
        const orders = await Order.find({ ShippingCompany: req.user._id, orderStatus: 'shipped' })
            .populate('user', 'username email Address phone')
            .populate('items.product', 'name price imageUrl Address');
        res.status(200).json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
})];

/**
 * * @desc update order status to delivered
 * * @route /api/orders/shipped/:id
 * * @method put
 */
exports.updateOrderStatus = [shipped, asyncHandler(async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        order.orderStatus = 'delivered';
        order.deliveryDate = Date.now();
        await order.save();

        // Send email to user
        const user = await Auth.findById(order.user);
        if (user) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL,
                    pass: process.env.EMAIL_PASSWORD,
                },
            });

            const mailOptions = {
                from: process.env.EMAIL,
                to: user.email,
                subject: 'Order Delivered',
                text: `Your order with ID ${orderId} has been delivered.`,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });
        }

        res.status(200).json({ message: 'Order status updated to delivered', order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
})];