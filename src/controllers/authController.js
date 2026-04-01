const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/brevo');
const Batch = require('../models/Batch');
const Division = require('../models/Division');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '2h' });
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
            // Success: Reset security fields
            user.failedLoginAttempts = 0;
            user.lockUntil = null;
            user.lastLogin = new Date();
            await user.save();

            const token = generateToken(user._id);

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
            if (!['super_admin', 'administrator'].includes(user.role)) {
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
            res.status(401).json({ success: false, message: 'Invalid credentials' });
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
exports.sendOTP = async (req, res) => {
    try {
        res.status(501).json({ success: false, message: 'OTP functionality is under maintenance.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.loginWithOTP = async (req, res) => {
    try {
        res.status(501).json({ success: false, message: 'OTP login is under maintenance.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
