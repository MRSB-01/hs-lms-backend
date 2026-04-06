const envConfig = require('../config/envConfig');
const College = require('../models/College');
const User = require('../models/User');
const { Course } = require('../models/Course');
const { Payment } = require('../models/Tracking');
const { Test: Exam, Result } = require('../models/Exam');
const Batch = require('../models/Batch');
const Division = require('../models/Division');
const { sendEmail } = require('../utils/brevo');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/crypto');
const mongoose = require('mongoose');

// Helper: Generate a strong random password (12 chars, mix of upper, lower, digits, symbols)
const generateSecurePassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '@#$%&*!?';
    const all = upper + lower + digits + symbols;
    // Guarantee at least one of each type
    let pwd = [
        upper[Math.floor(Math.random() * upper.length)],
        lower[Math.floor(Math.random() * lower.length)],
        digits[Math.floor(Math.random() * digits.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
    ];
    for (let i = pwd.length; i < 12; i++) {
        pwd.push(all[Math.floor(Math.random() * all.length)]);
    }
    // Shuffle
    return pwd.sort(() => Math.random() - 0.5).join('');
};

// 1. Dashboard Dynamic Analytics (Advanced)
exports.getDashboardStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = { 
                $gte: new Date(startDate), 
                $lte: new Date(endDate) 
            };
        }

        const statsPromise = Promise.all([
            College.countDocuments(), // ALL
            College.countDocuments({ status: 'approved' }),
            College.countDocuments({ status: 'suspended' }),
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'user' }), // B2C
            User.countDocuments(), // Total
            Course.countDocuments(),
            Exam.countDocuments(),
            Payment.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Promise.resolve([])
        ]);

        const [
            totalColleges_all,
            activeColleges,
            suspendedColleges,
            totalStudents,
            totalIndividualUsers,
            totalUsers,
            totalCourses,
            totalExams,
            paymentSummary,
            recentActivity
        ] = await statsPromise;

        // Charts Logic (Last 12 Months)
        const last12Months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            last12Months.push({
                month: d.toLocaleString('default', { month: 'short' }),
                year: d.getFullYear(),
                monthIndex: d.getMonth(),
                fullDate: new Date(d.getFullYear(), d.getMonth(), 1)
            });
        }

        // Monthly Revenue
        const revenueData = await Payment.aggregate([
            { $match: { status: 'completed', createdAt: { $gte: last12Months[0].fullDate } } },
            { $group: {
                _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
                total: { $sum: "$amount" }
            }}
        ]);

        // Monthly College Growth
        const collegeGrowth = await College.aggregate([
            { $match: { status: 'approved', createdAt: { $gte: last12Months[0].fullDate } } },
            { $group: {
                _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
                count: { $sum: 1 }
            }}
        ]);

        // Monthly Students enrollment
        const studentEnrollment = await User.aggregate([
            { $match: { role: 'student', createdAt: { $gte: last12Months[0].fullDate } } },
            { $group: {
                _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
                count: { $sum: 1 }
            }}
        ]);

        // Monthly Exams
        const examActivity = await Exam.aggregate([
            { $match: { createdAt: { $gte: last12Months[0].fullDate } } },
            { $group: {
                _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
                count: { $sum: 1 }
            }}
        ]);

        // Top 5 Colleges by student count
        const topColleges = await User.aggregate([
            { $match: { role: 'student', collegeId: { $ne: null } } },
            { $group: { _id: "$collegeId", studentCount: { $sum: 1 } } },
            { $sort: { studentCount: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'colleges', localField: '_id', foreignField: '_id', as: 'college' } },
            { $unwind: "$college" },
            { $project: { name: "$college.collegeName", studentCount: 1 } }
        ]);

        // Pass/Fail distribution (simplified from exam results if available)
        // Here we just use a dummy aggregation if the schema permits or 
        // we might need to look at student results.
        // For now, let's assume 70% pass 30% fail as a starting point or compute if results model exists
        // Actually, Exam model has result summaries.
        const examResultsAgg = await Result.aggregate([
            { $group: { 
                _id: null, 
                passed: { $sum: { $cond: [{ $eq: ["$status", "pass"] }, 1, 0] } },
                total: { $sum: 1 }
            } }
        ]);

        const passRate = examResultsAgg.length > 0 ? Math.round((examResultsAgg[0].passed / examResultsAgg[0].total) * 100) : 0;
        const failRate = examResultsAgg.length > 0 ? 100 - passRate : 0;

        const chartData = last12Months.map(m => {
            const rev = revenueData.find(r => r._id.month === (m.monthIndex + 1) && r._id.year === m.year);
            const clg = collegeGrowth.find(c => c._id.month === (m.monthIndex + 1) && c._id.year === m.year);
            const std = studentEnrollment.find(s => s._id.month === (m.monthIndex + 1) && s._id.year === m.year);
            const exm = examActivity.find(e => e._id.month === (m.monthIndex + 1) && e._id.year === m.year);

            return {
                name: m.month,
                revenue: rev?.total || 0,
                colleges: clg?.count || 0,
                students: std?.count || 0,
                exams: exm?.count || 0
            };
        });

        res.json({
            success: true,
            data: {
                summary: {
                    totalColleges: totalColleges_all,
                    activeColleges,
                    suspendedColleges,
                    totalStudents,
                    totalIndividualUsers,
                    totalUsers,
                    totalCourses,
                    totalExams,
                    totalRevenue: paymentSummary[0]?.total || 0,
                    testRevenue: await Payment.aggregate([
                        { $match: { status: 'completed', itemType: 'test' } },
                        { $group: { _id: null, total: { $sum: '$amount' } } }
                    ]).then(r => r[0]?.total || 0),
                    courseRevenue: await Payment.aggregate([
                        { $match: { status: 'completed', itemType: 'course' } },
                        { $group: { _id: null, total: { $sum: '$amount' } } }
                    ]).then(r => r[0]?.total || 0)
                },
                charts: {
                    combinedMonthly: chartData,
                    topColleges,
                    distribution: [
                        { name: 'College Students', value: totalStudents },
                        { name: 'Individual Users', value: totalIndividualUsers }
                    ],
                    examPerformance: [
                        { name: 'Pass', value: passRate || 100 }, 
                        { name: 'Fail', value: failRate || 0 }
                    ]
                },
                recentActivity
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. College Requests Management
exports.getCollegeRequests = async (req, res) => {
    try {
        const requests = await College.find({ status: 'pending' }).sort({ createdAt: -1 });
        res.json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.approveCollegeRequest = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const college = await College.findById(collegeId);
        
        if (!college) return res.status(404).json({ success: false, message: 'College request not found' });
        if (college.status === 'approved') return res.status(400).json({ success: false, message: 'College already approved' });

        // Generate strong College Admin credentials
        const rawPassword = generateSecurePassword();
        
        const admin = await User.create({
            name: `${college.collegeName} Admin`,
            email: college.contactEmail,
            password: rawPassword, // Will be hashed via pre-save
            credentialPassEncrypted: encrypt(rawPassword), // Reversible for Super Admin
            role: 'college_admin',
            collegeId: college._id,
            isVerified: true
        });

        college.status = 'approved';
        college.adminId = admin._id;
        college.code = `CLG-${Math.floor(1000 + Math.random() * 9000)}`;
        college.courseAccess = 'full';
        college.generatedPassword = rawPassword; // Store plain-text for Super Admin reference
        await college.save();

        const loginUrl = `${envConfig.CLIENT_URL}/login/college-admin`;

        await sendEmail({
            to: college.contactEmail,
            subject: 'Your LMS College Access Has Been Approved',
            htmlContent: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 20px;">
                    <h2 style="color: #2563eb; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">Welcome to HS LMS</h2>
                    <p>Hello <b>${college.collegeName}</b>,</p>
                    <p>We are excited to inform you that your request to access the HS LMS platform has been approved by the Super Administrator.</p>
                    
                    <div style="background: #f8fafc; padding: 25px; border-radius: 15px; margin: 30px 0; border: 1px solid #e2e8f0;">
                         <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Administrative Credentials</p>
                         <p style="margin: 10px 0 5px 0;"><b>Login ID:</b> ${college.contactEmail}</p>
                         <p style="margin: 0;"><b>Temporary Password:</b> <code style="background: #fee2e2; padding: 2px 8px; color: #991b1b; border-radius: 4px;">${rawPassword}</code></p>
                    </div>

                    <p style="font-weight: 700; color: #b91c1c;">IMPORTANT: Please log in and change your password immediately to secure your institutional account.</p>
                    
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="${loginUrl}" style="background: #2563eb; color: white; padding: 15px 35px; text-decoration: none; border-radius: 12px; font-weight: 800; text-transform: uppercase; font-size: 13px; letter-spacing: 1px;">Access Institution Portal</a>
                    </div>
                    
                    <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">Best Regards,<br><b>HS LMS Automations</b></p>
                </div>
            `
        });

        res.json({ 
            success: true, 
            message: 'College approved successfully.',
            data: {
                collegeName: college.collegeName,
                generatedEmail: college.contactEmail,
                generatedPassword: rawPassword
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCollegeCredentials = async (req, res) => {
    try {
        const college = await College.findById(req.params.collegeId);
        if (!college || !college.adminId) return res.status(404).json({ success: false, message: 'College admin not found' });
        
        // IMPORTANT: explicitly select credentialPassEncrypted along with password
        const admin = await User.findById(college.adminId).select('+password +credentialPassEncrypted');
        if (!admin) return res.status(404).json({ success: false, message: 'Admin user not found' });

        // Debug log to trace credential lookup
        
        
        

        let plainPassword = null;
        let passwordAvailable = true;

        if (college.generatedPassword) {
            plainPassword = college.generatedPassword;
            
        } else if (admin.credentialPassEncrypted) {
            const decrypted = decrypt(admin.credentialPassEncrypted);
            
            if (decrypted) {
                plainPassword = decrypted;
                // Backfill generatedPassword for future lookups
                college.generatedPassword = decrypted;
                await college.save();
            }
        }

        if (!plainPassword) {
            passwordAvailable = false;
            plainPassword = 'Not on file — please regenerate password.';
        }

        res.json({
            success: true,
            data: {
                collegeName: college.collegeName,
                loginEmail: admin.email,
                currentPassword: plainPassword,
                passwordAvailable,
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

        admin.password = newPassword; 
        admin.credentialPassEncrypted = encrypt(newPassword);
        await admin.save();

        res.json({ success: true, message: 'College admin password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.resetCollegePassword = async (req, res) => {
    try {
        const college = await College.findById(req.params.collegeId);
        if (!college || !college.adminId) return res.status(404).json({ success: false, message: 'College admin not found' });

        const admin = await User.findById(college.adminId);
        if (!admin) return res.status(404).json({ success: false, message: 'Admin user not found' });

        const rawPassword = generateSecurePassword();
        admin.password = rawPassword; 
        admin.credentialPassEncrypted = encrypt(rawPassword);
        await admin.save();

        // Also update plain text on college document
        college.generatedPassword = rawPassword;
        await college.save();

        const loginUrl = `${envConfig.CLIENT_URL}/login/college-admin`;

        await sendEmail({
            to: admin.email,
            subject: 'LMS College Access - Password Reset',
            htmlContent: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 20px;">
                    <h2 style="color: #2563eb; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">Password Reset Notice</h2>
                    <p>Hello <b>${college.collegeName}</b>,</p>
                    <p>Your institutional access password for the HS LMS platform has been securely reset by the Super Administrator.</p>
                    
                    <div style="background: #f8fafc; padding: 25px; border-radius: 15px; margin: 30px 0; border: 1px solid #e2e8f0;">
                         <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">New Credentials</p>
                         <p style="margin: 10px 0 5px 0;"><b>Login ID:</b> ${admin.email}</p>
                         <p style="margin: 0;"><b>New Password:</b> <code style="background: #fee2e2; padding: 2px 8px; color: #991b1b; border-radius: 4px;">${rawPassword}</code></p>
                    </div>

                    <p style="font-weight: 700; color: #b91c1c;">Please log in and update your security settings immediately.</p>
                    
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="${loginUrl}" style="background: #2563eb; color: white; padding: 15px 35px; text-decoration: none; border-radius: 12px; font-weight: 800; text-transform: uppercase; font-size: 13px; letter-spacing: 1px;">Return to Portal</a>
                    </div>
                    
                    <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">Best Regards,<br><b>HS LMS Automations</b></p>
                </div>
            `
        });

        res.json({ 
            success: true, 
            message: 'College admin password reset successfully.',
            data: {
                newPassword: rawPassword
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Total Sales Tracking
exports.getSalesSummary = async (req, res) => {
    try {
        const topCourses = await Payment.aggregate([
            { $match: { status: 'completed' } },
            { $group: { 
                _id: '$courseId', 
                totalRevenue: { $sum: '$amount' },
                purchaseCount: { $sum: 1 }
            }},
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 },
            { $lookup: {
                from: 'courses',
                localField: '_id',
                foreignField: '_id',
                as: 'courseDetails'
            }},
            { $unwind: '$courseDetails' }
        ]);

        const summary = await Payment.aggregate([
            { $match: { status: 'completed' } },
            { $group: { 
                _id: null, 
                totalRevenue: { $sum: '$amount' },
                totalPurchases: { $sum: 1 }
            }}
        ]);

        res.json({ 
            success: true, 
            data: {
                totalRevenue: summary[0]?.totalRevenue || 0,
                totalPurchases: summary[0]?.totalPurchases || 0,
                topCourses: topCourses.map(c => ({
                    id: c._id,
                    title: c.courseDetails.title,
                    revenue: c.totalRevenue,
                    purchases: c.purchaseCount
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Colleges Management - Full CRUD
exports.getAllColleges = async (req, res) => {
    try {
        const colleges = await College.aggregate([
            { $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: 'collegeId',
                as: 'students'
            }},
            { $lookup: {
                from: 'batches',
                localField: '_id',
                foreignField: 'collegeId',
                as: 'batches'
            }},
            { $lookup: {
                from: 'users', // To find the admin and check their status
                localField: 'adminId',
                foreignField: '_id',
                as: 'adminUser'
            }},
            { $project: {
                collegeName: 1,
                status: 1,
                contactEmail: 1,
                contactPhone: 1,
                address: 1,
                code: 1,
                adminId: 1,
                adminStatus: { $arrayElemAt: ["$adminUser.status", 0] },
                createdAt: 1,
                totalStudents: { 
                    $size: { 
                        $filter: { 
                            input: '$students', 
                            as: 'student', 
                            cond: { $eq: ['$$student.role', 'student'] } 
                        } 
                    } 
                },
                totalBatches: { $size: "$batches" },
                // Roughly estimate courses assigned by looking at assignments to those batches
                // This is a bit complex for a simple projection, but we can do a lookup later if needed
            }}
        ]);
        res.json({ success: true, data: colleges });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.toggleCollegeStatus = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const { status } = req.body; // 'approved' or 'suspended'
        
        const college = await College.findById(collegeId);
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });

        college.status = status;
        await college.save();

        // Also suspend the college admin if the college is suspended
        if (college.adminId) {
            await User.findByIdAndUpdate(college.adminId, { status: status === 'suspended' ? 'suspended' : 'active' });
        }

        res.json({ success: true, message: `College ${status === 'suspended' ? 'suspended' : 'activated'} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Exams Management
exports.getAllExams = async (req, res) => {
    try {
        const exams = await Exam.find()
            .populate('collegeId', 'collegeName')
            .populate('assignedBatches', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: exams });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.toggleExamStatus = async (req, res) => {
    try {
        const { examId } = req.params;
        const { isActive } = req.body;
        
        const exam = await Exam.findByIdAndUpdate(examId, { status: isActive ? 'active' : 'disabled' }, { new: true });
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

        res.json({ success: true, message: `Exam ${isActive ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 6. Students & Individual Users Management
exports.getAllUsersByRole = async (req, res) => {
    try {
        const { role } = req.query; // 'student' or 'user'
        const users = await User.find({ role })
            .populate('collegeId', 'collegeName')
            .populate('batchId', 'batchName')
            .populate('divisionId', 'divisionName')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.toggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body; // 'active' or 'suspended'
        
        const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.json({ success: true, message: `Account ${status === 'suspended' ? 'suspended' : 'activated'} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteUserPermanently = async (req, res) => {
    try {
        const { userId } = req.params;
        const { confirmation } = req.body;

        if (confirmation !== 'DELETE') {
            return res.status(400).json({ success: false, message: 'Invalid confirmation' });
        }

        const userToDelete = await User.findById(userId);
        if (!userToDelete) return res.status(404).json({ success: false, message: 'User not found' });
        
        if (req.user.role === 'super_admin' && userToDelete.role === 'administrator') {
            return res.status(403).json({ success: false, message: 'Super Admin cannot delete an Administrator' });
        }

        await User.findByIdAndDelete(userId);

        res.json({ success: true, message: 'User permanently deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 7. Divisions & Batches
exports.getAllDivisions = async (req, res) => {
    try {
        const divisions = await Division.find()
            .populate({
                path: 'batchId',
                select: 'name collegeId',
                populate: {
                    path: 'collegeId',
                    select: 'collegeName'
                }
            })
            .sort({ createdAt: -1 });
        res.json({ success: true, data: divisions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteDivision = async (req, res) => {
    try {
        await Division.findByIdAndDelete(req.params.divisionId);
        res.json({ success: true, message: 'Division deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllBatches = async (req, res) => {
    try {
        const batches = await Batch.find()
            .populate('collegeId', 'collegeName')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: batches });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteBatch = async (req, res) => {
    try {
        await Batch.findByIdAndDelete(req.params.batchId);
        res.json({ success: true, message: 'Batch deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 9. Revenue & Payments
exports.getPaymentsReport = async (req, res) => {
    try {
        const payments = await Payment.find({ status: 'completed' })
            .populate('userId', 'name email')
            .populate('courseId', 'title')
            .populate('testId', 'title')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: payments });
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
            code: `CLG-${Math.floor(1000 + Math.random() * 9000)}`,
            courseAccess: 'full'
        });

        res.status(201).json({ success: true, data: college, message: 'College created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateCollege = async (req, res) => {
    try {
        const college = await College.findByIdAndUpdate(req.params.collegeId, req.body, { new: true, runValidators: true });
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });
        res.json({ success: true, data: college });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteCollege = async (req, res) => {
    try {
        const { confirmation } = req.body;
        if (confirmation !== 'DELETE') {
            return res.status(400).json({ success: false, message: 'Invalid confirmation' });
        }

        const college = await College.findByIdAndDelete(req.params.collegeId);
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });
        
        // Also delete the admin associated
        if (college.adminId) await User.findByIdAndDelete(college.adminId);
        
        res.json({ success: true, message: 'College and its admin deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Course Allocation
exports.allocateCourses = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const { courseIds } = req.body; // Array of course IDs

        const college = await College.findById(collegeId);
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });

        college.allocatedCourses = courseIds;
        await college.save();

        res.json({ success: true, message: 'Courses allocated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllocatedCourses = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const college = await College.findById(collegeId).populate('allocatedCourses');
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });

        res.json({ success: true, data: college.allocatedCourses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
