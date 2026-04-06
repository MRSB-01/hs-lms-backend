const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { createOrder, verifyPayment } = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');

// Validation middleware for creating order
const createOrderValidation = [
    body('itemType')
        .notEmpty().withMessage('Item type is required')
        .isIn(['course', 'test', 'b2c_test']).withMessage('Invalid item type'),
];

router.post('/create-order', protect, createOrderValidation, createOrder);
router.post('/verify', protect, verifyPayment);

module.exports = router;
