var express = require('express');
var router = express.Router();
const { verifyToken, verifyTokenAndAuthorization } = require('../../middlewares/verifytoken');
const { deleteProduct, deleteReview, deleteUser, getAllOrders, getAllUsers, updateCategory, updateOrderStatus } = require("../controllers/adminController");


router.delete('/delete-product/:id', verifyTokenAndAuthorization, deleteProduct);
router.delete('/delete-review/:id', verifyTokenAndAuthorization, deleteReview);
router.delete('/delete-user/:id', verifyTokenAndAuthorization, deleteUser);
router.get('/all-orders', verifyTokenAndAuthorization, getAllOrders);
router.get('/all-users', verifyTokenAndAuthorization, getAllUsers);
router.put('/update-category/:id', verifyTokenAndAuthorization, updateCategory);
router.put('/update-order-status/:id', verifyTokenAndAuthorization, updateOrderStatus);

module.exports = router;