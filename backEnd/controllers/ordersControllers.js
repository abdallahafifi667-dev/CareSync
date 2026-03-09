const Product = require('../../models/E-commerce/products');
const { category: Category } = require('../../models/plog/category');
const Order = require('../../models/E-commerce/orders');
const { getUserModel } = require("../../models/users-core/users.models");
const Auth = getUserModel();
const Contract = require('../../models/E-commerce/contract');
const NotificationService = require("../../Notification/notificationService");
const nodemailer = require('nodemailer');
const asyncHandler = require('express-async-handler');
const xss = require('xss');
const Joi = require('joi');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Basket data validation function
const validateAddToCart = (data) => {
    const schema = Joi.object({
        product: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        price: Joi.number().min(0).required()
    });
    return schema.validate(data);
};

/**
 * @desc   add product in the cart
 * @route   POST /api/orders/addToCart
 * @access  عام
 */
exports.addToCart = asyncHandler(async (req, res) => {
    const data = {
        product: xss(req.body.product),
        quantity: xss(req.body.quantity),
        price: xss(req.body.price),
    }
    const { error } = validateAddToCart(data);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    const product = await Product.findById(data.product);
    if (!product) {
        return res.status(404).json({ message: 'product not found' });
    }
    if (product.stockQuantity < data.quantity) {
        return res.status(400).json({ message: 'not enough stock' });
    }
    product.stockQuantity -= data.quantity;
    product.ReservedQuantity += data.quantity;
    await product.save();

    if (product.price !== data.price) {
        return res.status(400).json({ message: 'price not match' });
    }
    const order = await Order.findOne({
        user: req.user.id, orderStatus: 'pending'
    })
    if (!order) {
        const newOrder = new Order({
            user: req.user.id,
            items: [data],
            totalAmount: data.price * data.quantity,
            orderStatus: 'pending',
        });
        await newOrder.save();
        return res.status(201).json({ message: 'product added to cart', order: newOrder });
    } else {
        const itemIndex = order.items.findIndex(item => item.product.toString() === data.product);
        if (itemIndex > -1) {
            order.items[itemIndex].quantity += data.quantity;
            order.items[itemIndex].price = data.price;
        } else {
            order.items.push(data);
        }
        order.totalAmount += data.price * data.quantity;
        await order.save();
        return res.status(200).json({ message: 'product added to cart', order });
    }
});

/**
 * @desc   remove product from the cart
 * @route   DELETE /api/orders/removeFromCart/:id
 * @access  عام
 */
exports.removeFromCart = asyncHandler(async (req, res) => {
    const order = await Order.findOne({
        user: req.user.id, orderStatus: 'pending'
    });
    if (!order) {
        return res.status(404).json({ message: 'order not found' });
    }
    const itemIndex = order.items.findIndex(item => item.product.toString() === req.params.id);
    if (itemIndex === -1) {
        return res.status(404).json({ message: 'item not found in cart' });
    }
    const product = await Product.findById(order.items[itemIndex].product);
    if (!product) {
        return res.status(404).json({ message: 'product not found' });
    }
    const removedItem = order.items[itemIndex];
    product.stockQuantity += removedItem.quantity;
    product.ReservedQuantity -= removedItem.quantity;
    await product.save();
    order.totalAmount -= removedItem.price * removedItem.quantity;
    order.items.splice(itemIndex, 1);
    await order.save();
    return res.status(200).json({ message: 'item removed from cart' });
});

/**
 * @desc   get cart items
 * @route   GET /api/orders/cartItems
 * @access  عام
 */
exports.getCartItems = asyncHandler(async (req, res) => {
    const order = await Order.findOne({
        user: req.user.id, orderStatus: 'pending'
    }).populate('items.product', 'name price imageUrl');
    if (!order) {
        return res.status(404).json({ message: 'order not found' });
    }
    return res.status(200).json({ order });
});

/**
 * @desc   checkout
 * @route   POST /api/orders/checkout
 * @access  عام
 */
exports.checkout = asyncHandler(async (req, res) => {
    const data = {
        address: xss(req.body.address),
        paymentMethod: xss(req.body.paymentMethod),
    }
    const order = await Order.findOne({ user: req.user.id, orderStatus: 'pending' }).populate('items.product');
    if (!order) {
        return res.status(404).json({ message: 'order not found' });
    }
    if (order.items.length === 0) {
        return res.status(400).json({ message: 'cart is empty' });
    }
    if (!data.address) {
        data.address = req.user.Address;
    }

    // Common shipping assignment logic based on contracts
    const firstProduct = order.items[0].product;
    const pharmacyId = firstProduct.author;
    const contract = await Contract.findOne({ pharmacy: pharmacyId, status: 'accepted' });

    let shippingCompanyId;
    if (contract) {
        shippingCompanyId = contract.shippingCompany;
    } else {
        const shippingCompanies = await Auth.find({ role: 'shipping_company' }).select('_id');
        if (shippingCompanies.length === 0) {
            return res.status(404).json({ message: 'no shipping companies found' });
        }
        const randomIndex = Math.floor(Math.random() * shippingCompanies.length);
        shippingCompanyId = shippingCompanies[randomIndex]._id;
    }

    order.ShippingCompany = shippingCompanyId;
    order.shippingAddress = data.address;
    order.paymentMethod = data.paymentMethod;

    if (data.paymentMethod === 'credit_card') {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: order.items.map(item => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.product.name,
                        images: [item.product.imageUrl],
                    },
                    unit_amount: Math.round(item.price * 100),
                },
                quantity: item.quantity,
            })),
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/success`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel`,
            client_reference_id: order._id.toString(),
        });
        return res.status(200).json({ session });
    } else if (data.paymentMethod == 'monetary') {
        order.orderStatus = 'pending';
        await order.save();

        // Send Notification through Socket/Push
        try {
            const shippingUser = await Auth.findById(order.ShippingCompany).select('fcmTokens');
            if (shippingUser && shippingUser.fcmTokens && shippingUser.fcmTokens.length > 0) {
                await NotificationService.sendToMultipleDevices(
                    shippingUser.fcmTokens,
                    "New Delivery Assigned",
                    `You have a new order from pharmacy to deliver to ${data.address}`,
                    { orderId: order._id.toString(), type: "ORDER_ASSIGNMENT" }
                );
            }
        } catch (pushError) {
            console.error("Failed to send push notification:", pushError);
        }

        // Send email to the store owner (using existing logic)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD,
            },
        });
        const mailOptions = {
            from: process.env.EMAIL,
            to: process.env.EMAIL,
            subject: 'New Order',
            text: `New order from ${req.user.username} with address ${data.address} and payment method ${data.paymentMethod}. Assigned to shipping company: ${shippingCompanyId}`,
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return res.status(500).json({ message: 'error sending email' });
            }
            return res.status(200).json({ message: 'order placed successfully', order });
        });
    }
    else {
        return res.status(400).json({ message: 'invalid payment method' });
    }
});


/**
 * @desc   webhook
 * @route   POST /api/orders/webhook
 * @access  عام
 */
exports.webhook = asyncHandler(async (req, res) => {
    const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const order = await Order.findOne({ _id: session.client_reference_id, orderStatus: 'pending' })
            .populate('user')
            .populate('ShippingCompany')
            .populate({
                path: 'items.product',
                populate: {
                    path: 'author'
                }
            });

        if (!order) {
            return res.status(404).json({ message: 'order not found' });
        }

        order.orderStatus = 'shipped';
        order.paymentStatus = 'paid';
        await order.save();

        const shippingFee = order.totalAmount * 0.1;
        const merchantAmount = order.totalAmount - shippingFee;

        try {
            for (const item of order.items) {
                if (!item.product.author.stripeAccountId) {
                    throw new Error("التاجر ليس لديه حساب Stripe مرتبط");
                }
                const merchantAmount = item.price * item.quantity * 0.9;
                await stripe.transfers.create({
                    amount: Math.round(merchantAmount * 100),
                    currency: 'usd',

                    destination: item.product.author.stripeAccountId,
                    transfer_group: order._id.toString(),
                });
            }

            await stripe.transfers.create({
                amount: Math.round(shippingFee * 100),
                currency: 'usd',
                destination: order.ShippingCompany.stripeAccountId,
                transfer_group: order._id.toString(),
            });

            const merchantEmails = [...new Set(order.items.map(item => item.product.author.email))];
            const merchantTransporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL,
                    pass: process.env.PASSWORD,
                },
            });

            for (const email of merchantEmails) {
                const merchantMailOptions = {
                    from: process.env.EMAIL,
                    to: email,
                    subject: 'تم استلام دفعة جديدة',
                    text: `تم استلام دفعة جديدة بقيمة ${merchantAmount} دولار للطلب رقم ${order._id}`,
                };
                await merchantTransporter.sendMail(merchantMailOptions);
            }

            const shippingMailOptions = {
                from: process.env.EMAIL,
                to: order.ShippingCompany.email,
                subject: 'طلب شحن جديد',
                text: `تم استلام طلب شحن جديد بقيمة ${shippingFee} دولار للطلب رقم ${order._id}`,
            };
            await merchantTransporter.sendMail(shippingMailOptions);

            const customerMailOptions = {
                from: process.env.EMAIL,
                to: order.user.email,
                subject: 'تم تأكيد طلبك',
                text: `تم تأكيد طلبك رقم ${order._id} وسيتم شحنه قريباً`,
            };
            await merchantTransporter.sendMail(customerMailOptions);

            return res.status(200).json({
                message: 'تم معالجة الطلب بنجاح',
                order,
                transfers: {
                    merchant: merchantAmount,
                    shipping: shippingFee
                }
            });

        } catch (error) {
            console.error('خطأ في معالجة الدفع:', error);
            order.paymentStatus = 'failed';
            await order.save();
            return res.status(500).json({
                message: 'حدث خطأ في معالجة الدفع',
                error: error.message
            });
        }
    }
    return res.status(400).json({ message: 'نوع الحدث غير صالح' });
});


/**
 * * @desc  get all orders
 * * @route  GET /api/orders/allOrders
 * * @access  عام
 */
exports.getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user.id, orderStatus: 'shipped' })
    if (!orders) {
        return res.status(404).json({ message: 'no orders found' });
    }
    return res.status(200).json({ orders });
}
);

/**
 * * @desc  cancelled order
 * @route  POST /api/orders/cancelOrder
 * @access  عام
 */
exports.cancelOrder = asyncHandler(async (req, res) => {
    const order = await Order.findOne({
        user: req.user.id,
        orderStatus: { $in: ['shipped', 'delivered'] }
    })
        .populate('user')
        .populate('ShippingCompany')
        .populate({
            path: 'items.product',
            populate: { path: 'author' }
        });

    if (!order) {
        return res.status(404).json({ message: 'الطلب غير موجود أو غير قابل للإلغاء' });
    }

    try {
        const merchantRefund = order.totalAmount * 0.9;
        await stripe.transfers.createReversal(
            order.merchantTransferId,
            { amount: Math.round(merchantRefund * 100) }
        );

        const shippingRefund = order.totalAmount * 0.1;
        await stripe.transfers.createReversal(
            order.shippingTransferId,
            { amount: Math.round(shippingRefund * 100) }
        );

        await stripe.refunds.create({
            payment_intent: order.stripePaymentId,
            amount: Math.round(order.totalAmount * 100),
        });

        order.orderStatus = 'cancelled';
        await order.save();

        const transporter = nodemailer.createTransport({ /* إعدادات SMTP */ });

        await transporter.sendMail({
            to: order.items.product.author.email,
            subject: 'استرداد مبلغ الطلب الملغي',
            text: `تم استرداد ${merchantRefund} دولار من حسابك بسبب إلغاء الطلب ${order._id}`
        });

        await transporter.sendMail({
            to: order.ShippingCompany.email,
            subject: 'استرداد مبلغ الشحن',
            text: `تم استرداد ${shippingRefund} دولار من حسابك بسبب إلغاء الطلب ${order._id}`
        });

        res.status(200).json({ message: 'تم إلغاء الطلب واسترداد الأموال بنجاح' });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'حدث خطأ أثناء الاسترداد',
            error: error.message
        });
    }
});
