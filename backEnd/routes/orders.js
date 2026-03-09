var express = require('express');
var router = express.Router();
const { verifyToken } = require('../middlewares/verifytoken');
const { addToCart ,getCartItems ,removeFromCart ,checkout ,webhook ,getAllOrders ,cancelOrder } = require("../controllers/ordersControllers");

router.delete('/remove-from-cart/:id', verifyToken, removeFromCart);
router.post('/add-to-cart', verifyToken, addToCart);
router.post('/checkout', verifyToken, checkout);
router.post('/webhook', webhook);
router.post('/cancel-order/:id', verifyToken, cancelOrder);
router.get('/all-orders', verifyToken, getAllOrders);
router.get('/cart-items', verifyToken, getCartItems);



module.exports = router;
