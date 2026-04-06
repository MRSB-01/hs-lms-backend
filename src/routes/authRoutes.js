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
    updatePassword,
    verifySuperAdminOTP,
    resendSuperAdminOTP
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { validate, registerRules, loginRules } = require('../middlewares/validate');

router.post('/register', validate(registerRules), register);
router.post('/login', validate(loginRules), login);
router.post('/student-login', studentLogin);
router.post('/super-admin/verify-otp', verifySuperAdminOTP);
router.post('/super-admin/resend-otp', resendSuperAdminOTP);
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.put('/update-profile', protect, updateProfile);
router.put('/update-password', protect, updatePassword);

module.exports = router;
