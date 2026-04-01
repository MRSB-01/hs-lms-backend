const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { createOrder, verifyPayment } = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');

// Validation middleware for creating order
const createOrderValidation = [
    body('courseId')
        .notEmpty().withMessage('Course ID is required')
        .isMongoId().withMessage('Invalid Course ID format'),
];

router.post('/create-order', protect, createOrderValidation, createOrder);
router.post('/verify', protect, verifyPayment);

module.exports = router;
