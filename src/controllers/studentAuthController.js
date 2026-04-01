const User = require('../models/User');
const Batch = require('../models/Batch');
const { sendEmail } = require('../utils/brevo');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Helper to log activity
const logActivity = async (userId, action, details, collegeId, status = 'success') => {
    try {
        
    } catch (err) {
        
    }
};

// @desc    Register a student via Batch Code
// @route   POST /api/student/register
exports.registerStudent = async (req, res) => {
    try {
        const { name, email, password, batchCode } = req.body;

        // 1. Basic validation
        if (!name || !email || !password || !batchCode) {
            return res.status(400).json({ success: false, message: 'Please provide all fields' });
        }

        // Email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        // Password strength
        const passRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passRegex.test(password)) {
            return res.status(400).json({ success: false, message: 'Password must be 8+ chars with 1 uppercase and 1 number' });
        }

        // 2. Check Batch Code
        const batch = await Batch.findOne({ batchCode });
        if (!batch) {
            return res.status(404).json({ success: false, message: 'Invalid Batch Code' });
        }

        // 3. User already exists?
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // 4. Generate Student ID
        // Format: MCA25-001
        const studentCount = await User.countDocuments({ collegeId: batch.collegeId, role: 'student' });
        const studentId = `${batch.programName}${batch.year.slice(-2)}-${(studentCount + 1).toString().padStart(3, '0')}`;

        // 5. Create Verification Token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = Date.now() + 10 * 60 * 1000; // 10 mins

        // 6. Create Student
        const student = await User.create({
            name,
            email,
            password,
            role: 'student',
            studentId,
            collegeId: batch.collegeId,
            batchId: batch._id,
            isVerified: false,
            verificationToken,
            verificationTokenExpires
        });

        // 7. Send Verification Email
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
        await sendEmail({
            to: email,
            subject: 'Verify Your Email - HS LMS',
            htmlContent: `
                <div style="font-family: sans-serif; padding: 20px; color: #1f2937;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2563eb; font-style: italic; font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">HS <span style="color: #1f2937;">LMS</span></h1>
                    </div>
                    <h2 style="font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px;">Welcome to the Platform!</h2>
                    <p>Hello <strong>${name}</strong>,</p>
                    <p>Your institutional account has been provisioned. To finalize your registration and activate your courses, please verify your email identity.</p>
                    
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 16px; margin: 25px 0; border: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 12px; font-weight: 900; text-transform: uppercase; color: #6b7280; letter-spacing: 1px;">Your Private Student ID</p>
                        <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 900; color: #2563eb; font-family: monospace;">${studentId}</p>
                    </div>

                    <p style="font-size: 14px; color: #4b5563; font-style: italic; margin-bottom: 25px;">Note: This secure verification link is only valid for the next 10 minutes.</p>
                    
                    <a href="${verificationUrl}" style="background: #2563eb; color: white; padding: 18px 32px; text-decoration: none; border-radius: 14px; display: inline-block; font-weight: 900; text-transform: uppercase; font-size: 13px; letter-spacing: 1px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);">Secure Verification Access</a>
                    
                    <p style="margin-top: 40px; font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 800; letter-spacing: 2px;">Institutional Multi-Factor Authentication Enabled</p>
                </div>
            `
        });

        await logActivity(student._id, 'Student Registration', `Registered with ID ${studentId} for batch ${batch.name}`, batch.collegeId);

        res.status(201).json({ 
            success: true, 
            message: 'Registration successful! Please check your email to verify your account.',
            data: { studentId }
        });

    } catch (error) {
        
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Verify Email
// @route   GET /api/student/verify-email?token=...
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ success: false, message: 'Token is missing' });

        const student = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: Date.now() }
        });

        if (!student) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        student.isVerified = true;
        student.verificationToken = undefined;
        student.verificationTokenExpires = undefined;
        await student.save();

        await logActivity(student._id, 'Email Verification', 'Verified successfully', student.collegeId);

        res.json({ success: true, message: 'Email verified successfully! You can now login.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Student Login
// @route   POST /api/student/login
exports.loginStudent = async (req, res) => {
    try {
        const { studentId, password } = req.body;

        if (!studentId || !password) {
            return res.status(400).json({ success: false, message: 'Provide Student ID and Password' });
        }

        const student = await User.findOne({ studentId });
        if (!student) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check Lockout
        if (student.lockUntil && student.lockUntil > Date.now()) {
            const waitTime = Math.ceil((student.lockUntil - Date.now()) / (60 * 1000));
            return res.status(423).json({ success: false, message: `Account locked. Try again in ${waitTime} minutes.` });
        }

        // Verify Password
        const isMatch = await student.comparePassword(password);
        if (!isMatch) {
            student.loginAttempts += 1;
            if (student.loginAttempts >= 5) {
                student.lockUntil = Date.now() + 10 * 60 * 1000; // 10 mins lockout
                student.loginAttempts = 0;
            }
            await student.save();
            await logActivity(student._id, 'Login Attempt', 'Failed password', student.collegeId, 'failed');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if verified
        if (!student.isVerified) {
            return res.status(403).json({ success: false, message: 'Please verify your email first' });
        }

        // Update lastLogin
        student.lastLogin = new Date();
        student.loginAttempts = 0;
        student.lockUntil = undefined;
        await student.save();

        // Generate JWT
        const token = jwt.sign(
            { 
                id: student._id, 
                studentId: student.studentId, 
                batchId: student.batchId, 
                collegeId: student.collegeId, 
                role: 'student' 
            },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        // Activity Log
        await logActivity(student._id, 'Student Login', 'Success', student.collegeId);

        // Set Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 2 * 60 * 60 * 1000 // 2 hours
        });

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: student._id,
                name: student.name,
                email: student.email,
                studentId: student.studentId,
                role: 'student'
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Current Student Profile
// @route   GET /api/student/profile
exports.getProfile = async (req, res) => {
    try {
        const student = await User.findById(req.user.id)
            .populate('batchId')
            .populate('collegeId')
            .select('-password');
        
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        res.json({ success: true, data: student });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
