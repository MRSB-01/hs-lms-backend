const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
    registerStudent, 
    loginStudent, 
    verifyEmail, 
    getProfile 
} = require('../controllers/studentAuthController');
const { protect, authorize } = require('../middlewares/auth');

// Rate limiting for auth routes
const authLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: { success: false, message: 'Too many requests. Please try again in 1 minute.' }
});

router.post('/register', authLimit, registerStudent);
router.post('/login', authLimit, loginStudent);
router.get('/verify-email', verifyEmail);
router.get('/profile', protect, authorize('student'), getProfile);

module.exports = router;
