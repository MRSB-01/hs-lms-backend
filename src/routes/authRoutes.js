const express = require('express');
const router = express.Router();
const { 
    register, 
    login,
    studentLogin,
    sendOTP, 
    loginWithOTP, 
    logout, 
    getMe,
    updateProfile,
    updatePassword 
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { validate, registerRules, loginRules } = require('../middlewares/validate');

router.post('/register', validate(registerRules), register);
router.post('/login', validate(loginRules), login);
router.post('/student-login', studentLogin);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', loginWithOTP);
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.put('/update-profile', protect, updateProfile);
router.put('/update-password', protect, updatePassword);

module.exports = router;
