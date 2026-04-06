const envConfig = require('../config/envConfig');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/brevo');
const Batch = require('../models/Batch');
const Division = require('../models/Division');

const generateToken = (user) => {
    const expiresIn = user.role === 'super_admin' ? '24h' : '2h';
    return jwt.sign({ id: user._id }, envConfig.JWT_SECRET, { expiresIn });
};

// Security check for account lockout
const checkAccountLock = async (user) => {
    // Exclude Super Admin and Administrator from lockout
    if (['super_admin', 'administrator'].includes(user.role)) return { isLocked: false };

    if (user.lockUntil && user.lockUntil > Date.now()) {
        const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000);
        return { isLocked: true, remainingTime };
    }

    // If lockout expired, reset attempts
    if (user.lockUntil && user.lockUntil <= Date.now()) {
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        await user.save();
    }
    
    return { isLocked: false };
};

exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ success: false, message: 'Email already registered.' });

        const user = await User.create({ name, email, password, role: role || 'user', isVerified: true });
        const token = generateToken(user._id);

        // Send welcome email (non-blocking)
        try {
            const { getWelcomeEmail } = require('../utils/emailTemplates');
            await sendEmail({
                to: user.email,
                subject: 'Welcome to HS LMS - Your Learning Journey Begins!',
                htmlContent: getWelcomeEmail(user.name)
            });
        } catch (emailErr) {
            
        }

        res.status(201).json({ success: true, token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        
        // SUSPENSION CHECK
        if (user.status === 'suspended') {
            return res.status(403).json({ 
                success: false, 
                message: "Your account has been suspended. Please contact the administrator." 
            });
        }

        // COLLEGE SUSPENSION CHECK
        if (user.collegeId) {
            const college = await require('../models/College').findById(user.collegeId);
            if (college && college.status === 'suspended') {
                return res.status(403).json({ 
                    success: false, 
                    message: "Access blocked: Your institution is currently suspended." 
                });
            }
        }

        // Check Lock Status
        const lockStatus = await checkAccountLock(user);
        if (lockStatus.isLocked) {
            const mins = Math.floor(lockStatus.remainingTime / 60);
            const secs = lockStatus.remainingTime % 60;
            return res.status(423).json({ 
                success: false, 
                message: `Account locked. Try again in ${mins}m ${secs}s`,
                isLocked: true, 
                remainingTime: lockStatus.remainingTime 
            });
        }

        if (await user.comparePassword(password)) {
            // If super_admin, trigger OTP verification
            if (user.role === 'super_admin') {
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                user.otp = otp;
                user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
                user.otpAttempts = 0;
                user.otpLockUntil = null;
                await user.save();

                // Send email via Brevo
                const emailSent = await sendEmail({
                    to: user.email,
                    subject: 'HS LMS - Your Login Verification Code',
                    htmlContent: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #4a90e2;">Login Verification</h2>
                            <p>Your verification code for HS LMS is:</p>
                            <div style="font-size: 32px; font-weight: bold; padding: 15px; background: #f0f4f8; display: inline-block; border-radius: 8px; margin: 10px 0;">
                                ${otp}
                            </div>
                            <p>This code expires in 10 minutes.</p>
                            <p style="color: #666; font-size: 12px; margin-top: 20px;">If you did not request this OTP, please ignore this email.</p>
                        </div>
                    `
                });

                if (!emailSent) {
                    return res.status(500).json({ success: false, message: 'Failed to send verification code. Please try again later.' });
                }

                return res.json({
                    success: true,
                    requiresOTP: true,
                    email: user.email,
                    message: "Verification code sent to your registered email."
                });
            }

            // Success: Reset security fields
            user.failedLoginAttempts = 0;
            user.lockUntil = null;
            user.lastLogin = new Date();
            await user.save();

            const token = generateToken(user);

            res.json({
                success: true,
                token,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    collegeId: user.collegeId,
                    batchId: user.batchId,
                    divisionId: user.divisionId
                }
            });
        } else {
            // Failure: Increment security fields
            user.failedLoginAttempts += 1;
            
            if (user.failedLoginAttempts >= 3) {
                user.lockUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
                await user.save();
                return res.status(423).json({ 
                    success: false, 
                    message: "Your account has been locked for 5 minutes due to multiple failed login attempts.",
                    isLocked: true 
                });
            }
            
            await user.save();
            const remaining = 3 - user.failedLoginAttempts;
            return res.status(401).json({ 
                success: false, 
                message: `Incorrect credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before your account is locked.`,
                failedLoginAttempts: user.failedLoginAttempts 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.studentLogin = async (req, res) => {
    try {
        const { studentId, password } = req.body;
        const user = await User.findOne({ studentId, role: 'student' });

        if (!user) return res.status(401).json({ success: false, message: 'Student ID not found' });
        
        // SUSPENSION CHECK
        if (user.status === 'suspended') {
            return res.status(403).json({ 
                success: false, 
                message: "Your account has been suspended. Please contact the administrator." 
            });
        }

        // COLLEGE SUSPENSION CHECK
        if (user.collegeId) {
            const college = await require('../models/College').findById(user.collegeId);
            if (college && college.status === 'suspended') {
                return res.status(403).json({ 
                    success: false, 
                    message: "Access blocked: Your institution is currently suspended." 
                });
            }
        }

        const lockStatus = await checkAccountLock(user);
        if (lockStatus.isLocked) {
             const mins = Math.floor(lockStatus.remainingTime / 60);
             const secs = lockStatus.remainingTime % 60;
             return res.status(423).json({ success: false, message: `Account locked. Try again after ${mins}m ${secs}s`, isLocked: true });
        }

        if (await user.comparePassword(password)) {
            user.failedLoginAttempts = 0;
            user.lockUntil = null;
            await user.save();

            const token = generateToken(user._id);
            res.json({ success: true, token, user: { _id: user._id, name: user.name, role: user.role, studentId: user.studentId, collegeId: user.collegeId, batchId: user.batchId, divisionId: user.divisionId } });
        } else {
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= 3) {
                user.lockUntil = new Date(Date.now() + 5 * 60 * 1000);
                await user.save();
                return res.status(423).json({ success: false, message: "Your account has been locked for 5 minutes.", isLocked: true });
            }
            await user.save();
            const remaining = 3 - user.failedLoginAttempts;
            return res.status(401).json({ success: false, message: `Incorrect credentials. ${remaining} attempts remaining.` });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('collegeId').populate('batchId');
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, profileImage, contactNumber } = req.body;
        const user = await User.findById(req.user.id);
        if (name) user.name = name;
        if (profileImage) user.profileImage = profileImage;
        if (contactNumber) user.contactNumber = contactNumber;
        await user.save();
        res.json({ success: true, message: 'Profile updated success', data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const { encrypt } = require('../utils/crypto');

exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ success: false, message: 'Invalid current password' });
        
        user.password = newPassword; 
        if (user.role === 'college_admin') user.credentialPassEncrypted = encrypt(newPassword);
        await user.save();
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.logout = (req, res) => {
    res.json({ success: true, message: 'Logged out' });
};

// Placeholder for OTP functionality used in routes but not yet implemented in controller
exports.verifySuperAdminOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email, role: 'super_admin' });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Admin account not found.' });
        }

        // Check if OTP block is active
        if (user.otpLockUntil && user.otpLockUntil > Date.now()) {
            const mins = Math.ceil((user.otpLockUntil - Date.now()) / (60 * 1000));
            return res.status(423).json({ success: false, message: `Too many failed attempts. Try again in ${mins} minutes.` });
        }

        // Verify OTP
        if (user.otp !== otp) {
            user.otpAttempts += 1;
            if (user.otpAttempts >= 3) {
                user.otpLockUntil = new Date(Date.now() + 5 * 60 * 1000); // Block for 5 minutes
            }
            await user.save();
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }

        // Check expiry
        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        // Success: Clear OTP fields and issue token
        user.otp = null;
        user.otpExpiry = null;
        user.otpAttempts = 0;
        user.otpLockUntil = null;
        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.resendSuperAdminOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email, role: 'super_admin' });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Admin account not found.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        user.otpAttempts = 0;
        user.otpLockUntil = null;
        await user.save();

        await sendEmail({
            to: user.email,
            subject: 'HS LMS - Your Login Verification Code',
            htmlContent: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4a90e2;">New Login Verification Code</h2>
                    <p>Your new verification code for HS LMS is:</p>
                    <div style="font-size: 32px; font-weight: bold; padding: 15px; background: #f0f4f8; display: inline-block; border-radius: 8px; margin: 10px 0;">
                        ${otp}
                    </div>
                    <p>This code expires in 10 minutes.</p>
                    <p style="color: #666; font-size: 12px; margin-top: 20px;">If you did not request this OTP, please ignore this email.</p>
                </div>
            `
        });

        res.json({ success: true, message: 'A new OTP has been sent to your email.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
