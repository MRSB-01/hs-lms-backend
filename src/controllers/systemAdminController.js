const envConfig = require('../config/envConfig');
const User = require('../models/User');
const College = require('../models/College');
const { Course } = require('../models/Course');
const { Payment } = require('../models/Tracking');

// 1. Unified Create User (Administrator has full control over all roles, including Super Admin)
exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role, isActive } = req.body;

        if (req.user.role === 'super_admin' && role === 'administrator') {
            return res.status(403).json({ success: false, message: 'Super Admin cannot create an Administrator' });
        }
        
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ success: false, message: 'User already exists' });

        const user = await User.create({
            name,
            email,
            password,
            role: role || 'user',
            isActive: isActive !== undefined ? isActive : true,
            isVerified: true
        });

        // Hide password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        return res.status(201).json({ 
            success: true, 
            message: 'User created successfully',
            data: userResponse
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Full Platform Stats (Administrator)
exports.getFullPlatformStats = async (req, res) => {
    try {
        const [
            usersCount,
            collegesCount,
            coursesCount,
            studentsCount,
            totalRevenue,
            recentSales
        ] = await Promise.all([
            User.countDocuments(),
            College.countDocuments(),
            Course.countDocuments(),
            User.countDocuments({ role: 'student' }),
            Payment.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Payment.find({ status: 'completed' })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('userId', 'name email')
                .populate('courseId', 'title')
        ]);

        res.json({
            success: true,
            data: {
                summary: {
                    totalUsers: usersCount,
                    totalColleges: collegesCount,
                    totalCourses: coursesCount,
                    totalStudents: studentsCount,
                    totalRevenue: totalRevenue[0]?.total || 0,
                },
                recentSales
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. User Management
exports.getAllUsers = async (req, res) => {
    try {
        const query = {};
        if (req.user.role === 'super_admin') {
            query.role = { $ne: 'administrator' };
        }
        const users = await User.find(query).select('-password').sort({ createdAt: -1 });
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const userToDelete = await User.findById(req.params.userId);
        if (!userToDelete) return res.status(404).json({ success: false, message: 'User not found' });
        
        if (req.user.role === 'super_admin' && userToDelete.role === 'administrator') {
            return res.status(403).json({ success: false, message: 'Super Admin cannot delete an Administrator' });
        }

        await User.findByIdAndDelete(req.params.userId);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const userToUpdate = await User.findById(req.params.userId);
        if (!userToUpdate) return res.status(404).json({ success: false, message: 'User not found' });
        
        if (req.user.role === 'super_admin' && userToUpdate.role === 'administrator') {
            return res.status(403).json({ success: false, message: 'Super Admin cannot edit an Administrator' });
        }
        if (req.user.role === 'super_admin' && req.body.role === 'administrator') {
            return res.status(403).json({ success: false, message: 'Super Admin cannot promote to Administrator' });
        }

        const user = await User.findByIdAndUpdate(req.params.userId, req.body, { new: true }).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. College Management - Full CRUD for Administrator
exports.getAllColleges = async (req, res) => {
    try {
        const colleges = await College.aggregate([
            { $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: 'collegeId',
                as: 'students'
            }},
            { $project: {
                collegeName: 1,
                status: 1,
                contactEmail: 1,
                contactPhone: 1,
                address: 1,
                code: 1,
                adminId: 1,
                createdAt: 1,
                totalStudents: { 
                    $size: { 
                        $filter: { 
                            input: '$students', 
                            as: 'student', 
                            cond: { $eq: ['$$student.role', 'student'] } 
                        } 
                    } 
                }
            }}
        ]);
        res.json({ success: true, data: colleges });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createCollege = async (req, res) => {
    try {
        const { collegeName, contactEmail, contactPhone, address } = req.body;
        const exists = await College.findOne({ contactEmail });
        if (exists) return res.status(400).json({ success: false, message: 'A college with this email already exists' });

        const college = await College.create({
            collegeName,
            contactEmail,
            contactPhone,
            address,
            status: 'approved',
            code: `CLG-${Math.floor(1000 + Math.random() * 9000)}`
        });
        res.status(201).json({ success: true, data: college, message: 'College created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateCollege = async (req, res) => {
    try {
        const college = await College.findByIdAndUpdate(req.params.collegeId, req.body, { new: true });
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });
        res.json({ success: true, data: college });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteCollege = async (req, res) => {
    try {
        await College.findByIdAndDelete(req.params.collegeId);
        res.json({ success: true, message: 'College deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 6. Course Management - Full CRUD for Administrator
exports.manageCourses = async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.json({ success: true, data: courses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCollegeCredentials = async (req, res) => {
    try {
        const college = await College.findById(req.params.collegeId);
        if (!college || !college.adminId) return res.status(404).json({ success: false, message: 'College admin not found' });
        
        const admin = await User.findById(college.adminId);
        if (!admin) return res.status(404).json({ success: false, message: 'Admin user not found' });

        res.json({
            success: true,
            data: {
                loginId: admin.email,
                passwordMessage: 'Password is securely hashed (bcrypt). You can only reset or change it.',
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.changeCollegePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword) return res.status(400).json({ success: false, message: 'New password is required' });

        const college = await College.findById(req.params.collegeId);
        if (!college || !college.adminId) return res.status(404).json({ success: false, message: 'College admin not found' });

        const admin = await User.findById(college.adminId);
        if (!admin) return res.status(404).json({ success: false, message: 'Admin user not found' });

        admin.password = newPassword; // Will be hashed via pre-save hook
        await admin.save();

        res.json({ success: true, message: 'College admin password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.resetCollegePassword = async (req, res) => {
    try {
        const { sendEmail } = require('../utils/brevo');
        const college = await College.findById(req.params.collegeId);
        if (!college || !college.adminId) return res.status(404).json({ success: false, message: 'College admin not found' });

        const admin = await User.findById(college.adminId);
        if (!admin) return res.status(404).json({ success: false, message: 'Admin user not found' });

        const rawPassword = Math.random().toString(36).slice(-10);
        admin.password = rawPassword; // Will be hashed via pre-save hook
        await admin.save();

        // Optional: Send new email with credentials
        await sendEmail({
            to: admin.email,
            subject: 'LMS College Access - Password Reset',
            htmlContent: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <p>Hello ${college.collegeName},</p>
                    <p>Your password for the LMS platform has been reset by the administrator.</p>
                    <br>
                    <p>Login Details:</p>
                    <p>Login ID: ${admin.email}</p>
                    <p>Temporary Password: ${rawPassword}</p>
                    <br>
                    <p>Please login and change your password immediately.</p>
                    <p>Login Here:</p>
                    <p><a href="${envConfig.CLIENT_URL}/login/college-admin">${envConfig.CLIENT_URL}/login/college-admin</a></p>
                    <br>
                    <p>Best Regards</p>
                    <p>HS LMS Team</p>
                </div>
            `
        });

        res.json({ 
            success: true, 
            message: 'College admin password reset successfully.',
            data: { newPassword: rawPassword }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
