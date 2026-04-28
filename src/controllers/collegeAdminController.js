const User = require('../models/User');
const Batch = require('../models/Batch');
const Division = require('../models/Division');
const CourseAssignment = require('../models/CourseAssignment');
const College = require('../models/College');
const Announcement = require('../models/Announcement');
const mongoose = require('mongoose');
const { sendEmail } = require('../utils/brevo');

// Dashboard Stats
exports.getDashboardStats = async (req, res) => {
    try {
        const { Test } = require('../models/Exam');
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const collegeId = isAdmin ? (req.query.collegeId || null) : req.user.collegeId;
        if (!isAdmin && !collegeId) return res.status(400).json({ success: false, message: 'Institutional link (collegeId) is missing. Please contact support.' });

        const queryMatch = collegeId ? { collegeId } : {};
        const [
            totalBatches, 
            totalStudents, 
            totalAssignments, 
            totalTests, 
            pendingResults,
            recentActivity
        ] = await Promise.all([
            Batch.countDocuments(queryMatch),
            User.countDocuments({ role: 'student', ...queryMatch }),
            Batch.aggregate([
                { $match: queryMatch },
                { $project: { count: { $size: { $ifNull: ["$courses", []] } } } },
                { $group: { _id: null, total: { $sum: "$count" } } }
            ]),
            Test.countDocuments(queryMatch),
            Test.countDocuments({ isPublished: false, ...queryMatch }),
            Promise.resolve([])
        ]);

        res.json({
            success: true,
            data: {
                totalBatches,
                totalStudents,
                totalCoursesAssigned: totalAssignments[0]?.total || 0,
                totalTestsCreated: totalTests,
                totalTestsPendingResult: pendingResults,
                recentActivity: recentActivity.map(log => ({
                    action: log.action,
                    user: log.userId?.name || 'System',
                    timestamp: log.createdAt
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Batch Management - FULL CRUD
exports.createBatch = async (req, res) => {
    try {
        const { name, programName, year, batchCode: customCode } = req.body;
        
        let batchCode = customCode;
        if (!batchCode) {
            // Generate Format: BCA2025-A1X9
            const randomString = Math.random().toString(36).substring(2, 6).toUpperCase();
            batchCode = `${programName}${year}-${randomString}`;
        }

        // Ensure unique code
        const exists = await Batch.findOne({ batchCode });
        if (exists) return res.status(400).json({ success: false, message: 'Batch code already exists. Please use a unique code.' });

        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const reqCollegeId = isAdmin ? (req.body.collegeId || null) : req.user.collegeId;
        const batch = await Batch.create({
            name,
            programName,
            year,
            batchCode,
            collegeId: reqCollegeId
        });
        res.status(201).json({ success: true, data: batch });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBatches = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const collegeId = isAdmin ? (req.query.collegeId || null) : req.user.collegeId;
        if (!isAdmin && !collegeId) return res.status(400).json({ success: false, message: 'Institutional link (collegeId) is missing. Please contact support.' });
        
        const matchStage = collegeId ? { collegeId: new mongoose.Types.ObjectId(collegeId) } : {};
        const batches = await Batch.aggregate([
            { $match: matchStage },
            { $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: 'batchId',
                as: 'students'
            }},
            { $lookup: {
                from: 'divisions',
                localField: '_id',
                foreignField: 'batchId',
                as: 'divisions'
            }},
            { $project: {
                name: 1,
                batchCode: 1,
                programName: 1,
                year: 1,
                collegeId: 1,
                createdAt: 1,
                totalDivisions: { $size: '$divisions' },
                totalStudents: { $size: { $filter: { input: '$students', as: 's', cond: { $eq: ['$$s.role', 'student'] } } } },
                assignedCoursesCount: { $size: { $ifNull: ["$courses", []] } }
            }},
            { $sort: { createdAt: -1 } }
        ]);
        res.json({ success: true, data: batches });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateBatch = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const reqCollegeId = isAdmin ? (req.body.collegeId || req.query.collegeId || null) : req.user.collegeId;
        const query = { _id: req.params.batchId };
        if (reqCollegeId) query.collegeId = reqCollegeId;
        const batch = await Batch.findOne(query);
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

        if (name) batch.name = name;
        if (programName) batch.programName = programName;
        if (year) batch.year = year;
        
        if (batchCode && batchCode !== batch.batchCode) {
            const exists = await Batch.findOne({ batchCode });
            if (exists) return res.status(400).json({ success: false, message: 'Batch code already exists' });
            batch.batchCode = batchCode;
        }

        await batch.save();
        res.json({ success: true, data: batch });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteBatch = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const reqCollegeId = isAdmin ? (req.body.collegeId || req.query.collegeId || null) : req.user.collegeId;
        const query = { _id: req.params.batchId };
        if (reqCollegeId) query.collegeId = reqCollegeId;
        
        const batch = await Batch.findOne(query);
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
        
        // Remove associated divisions
        await Division.deleteMany({ batchId: batch._id });
        
        // Unlink students assigned to this batch
        await User.updateMany({ batchId: batch._id }, { $set: { batchId: null, divisionId: null, courses: [] } });
        
        // Final delete
        await Batch.findByIdAndDelete(batch._id);
        
        res.json({ success: true, message: 'Batch deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Division Management
exports.getDivisions = async (req, res) => {
    try {
        const { batchId } = req.params;
        if (!batchId) return res.status(400).json({ success: false, message: 'Batch ID is required' });
        const divisions = await Division.aggregate([
            { $match: { batchId: new mongoose.Types.ObjectId(batchId) } },
            { $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: 'divisionId',
                as: 'students'
            }},
            { $project: {
                name: 1,
                code: 1,
                totalStudents: { $size: '$students' }
            }}
        ]);
        res.json({ success: true, data: divisions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createDivision = async (req, res) => {
    try {
        const { name, batchId, code: customCode } = req.body;
        
        let code = customCode;
        if (!code) {
             code = 'DIV-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        }

        const exists = await Division.findOne({ code });
        if (exists) return res.status(400).json({ success: false, message: 'Division code already exists' });

        const division = await Division.create({
            name,
            batchId,
            code
        });
        res.status(201).json({ success: true, data: division });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateDivision = async (req, res) => {
    try {
        const { name, code } = req.body;
        const division = await Division.findById(req.params.divisionId);
        if (!division) return res.status(404).json({ success: false, message: 'Division not found' });

        if (name) division.name = name;
        if (code && code !== division.code) {
            const exists = await Division.findOne({ code });
            if (exists) return res.status(400).json({ success: false, message: 'Division code already exists' });
            division.code = code;
        }

        await division.save();
        res.json({ success: true, data: division });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteDivision = async (req, res) => {
    try {
        const division = await Division.findByIdAndDelete(req.params.divisionId);
        if (!division) return res.status(404).json({ success: false, message: 'Division not found' });
        
        // Unlink students
        await User.updateMany({ divisionId: division._id }, { $set: { divisionId: null } });
        
        res.json({ success: true, message: 'Division deleted and students unlinked' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Student Management
exports.addStudent = async (req, res) => {
    try {
        const { name, email, batchId, divisionId } = req.body;
        
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ success: false, message: 'Student email already exists' });

        const batch = await Batch.findById(batchId);
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

        // MCA25-001
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const collegeIdToCount = isAdmin ? (req.body.collegeId || batch.collegeId) : req.user.collegeId;
        const studentCount = await User.countDocuments({ collegeId: collegeIdToCount, role: 'student' });
        const studentId = `${batch.programName}${batch.year.slice(-2)}-${(studentCount + 1).toString().padStart(3, '0')}`;

        const password = Math.random().toString(36).slice(-8) + 'A@1'; // Ensure strength
        
        const reqCollegeId = isAdmin ? (req.body.collegeId || batch.collegeId) : req.user.collegeId;
        
        const student = await User.create({
            name,
            email,
            password, // Will be hashed by model middleware if pre-save is setup
            studentId,
            role: 'student',
            collegeId: reqCollegeId,
            batchId,
            divisionId,
            isVerified: true,
            isActive: true
        });

        // Send credentials email
        await sendEmail({
            to: email,
            subject: 'Student Login Credentials - HS LMS',
            htmlContent: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h1 style="color: #2563eb;">Welcome to HS LMS!</h1>
                    <p>Hello <strong>${name}</strong>,</p>
                    <p>Your student account has been created by your college administrator.</p>
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Student ID:</strong> ${studentId}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
                    </div>
                    <p>Please login and change your password immediately.</p>
                    <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Login Now</a>
                    <p style="margin-top: 30px; font-size: 12px; color: #666;">If you didn't expect this, please contact your college office.</p>
                </div>
            `
        });

        res.status(201).json({ success: true, data: student });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.bulkImportStudents = async (req, res) => {
    try {
        const csv = require('csv-parser');
        const fs = require('fs');
        
        if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a CSV file' });

        const results = [];
        const errors = [];
        const collegeId = req.user.collegeId;

        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                let imported = 0;
                let failed = 0;
                
                for (const [index, row] of results.entries()) {
                    try {
                        const { Name, Email, BatchCode, Division } = row;
                        
                        if (!Name || !Email || !BatchCode) {
                            errors.push({ row: index + 1, reason: 'Missing required fields' });
                            failed++;
                            continue;
                        }

                        const exists = await User.findOne({ email: Email });
                        if (exists) {
                            errors.push({ row: index + 1, reason: `Email ${Email} already exists` });
                            failed++;
                            continue;
                        }

                        const batch = await Batch.findOne({ batchCode: BatchCode, collegeId });
                        if (!batch) {
                            errors.push({ row: index + 1, reason: `Batch code ${BatchCode} invalid` });
                            failed++;
                            continue;
                        }

                        let divId = null;
                        if (Division) {
                            const division = await Division.findOne({ name: Division, batchId: batch._id });
                            if (division) divId = division._id;
                        }

                        // Generate ID
                        const studentCount = await User.countDocuments({ collegeId, role: 'student' });
                        const studentId = `${batch.programName}${batch.year.slice(-2)}-${(studentCount + 1 + imported).toString().padStart(3, '0')}`;
                        const tempPassword = Math.random().toString(36).slice(-8) + 'A@1';

                        const student = await User.create({
                            name: Name,
                            email: Email,
                            password: tempPassword,
                            studentId,
                            role: 'student',
                            collegeId,
                            batchId: batch._id,
                            divisionId: divId,
                            isVerified: true,
                            isActive: true
                        });

                        // Email (non-blocking for speed, but ideally use queue)
                        sendEmail({
                            to: Email,
                            subject: 'Login Credentials - HS LMS',
                            htmlContent: `<h1>Welcome!</h1><p>Student ID: ${studentId}</p><p>Password: ${tempPassword}</p>`
                        }).catch(err => {});

                        imported++;
                    } catch (err) {
                        errors.push({ row: index + 1, reason: err.message });
                        failed++;
                    }
                }

                // Cleanup file
                fs.unlinkSync(req.file.path);

                res.json({
                    success: true,
                    summary: { imported, failed, errors }
                });
            });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStudents = async (req, res) => {
    try {
        const { search, batchId, divisionId, page = 1, limit = 10 } = req.query;
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const reqCollegeId = isAdmin ? (req.query.collegeId || null) : req.user.collegeId;
        const query = { role: 'student' };
        if (reqCollegeId) query.collegeId = reqCollegeId;

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { studentId: { $regex: search, $options: 'i' } }
            ];
        }

        if (batchId) query.batchId = batchId;
        if (divisionId) query.divisionId = divisionId;

        const students = await User.find(query)
            .populate('batchId', 'name batchCode')
            .populate('divisionId', 'name code')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: students,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const reqCollegeId = isAdmin ? (req.body.collegeId || req.query.collegeId || null) : req.user.collegeId;
        const query = { _id: req.params.id, role: 'student' };
        if (reqCollegeId) query.collegeId = reqCollegeId;
        const student = await User.findOne(query);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        if (name) student.name = name;
        if (batchId) student.batchId = batchId;
        
        // Handle optional and cleared fields
        if (divisionId !== undefined) student.divisionId = divisionId === "" ? null : divisionId;
        if (studentId !== undefined) student.studentId = studentId;
        if (isActive !== undefined) student.isActive = isActive;

        await student.save();
        res.json({ success: true, data: student });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.toggleStudentStatus = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const reqCollegeId = isAdmin ? (req.body.collegeId || req.query.collegeId || null) : req.user.collegeId;
        const query = { _id: req.params.id, role: 'student' };
        if (reqCollegeId) query.collegeId = reqCollegeId;
        const student = await User.findOne(query);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const isSuspended = student.status === 'suspended';
        student.status = isSuspended ? 'active' : 'suspended';
        student.isActive = !isSuspended;
        await student.save();
        
        res.json({ success: true, message: `Student ${student.status === 'active' ? 'activated' : 'suspended'} successfully`, status: student.status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.resetStudentPassword = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const reqCollegeId = isAdmin ? (req.body.collegeId || req.query.collegeId || null) : req.user.collegeId;
        const query = { _id: req.params.id, role: 'student' };
        if (reqCollegeId) query.collegeId = reqCollegeId;
        const student = await User.findOne(query);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const newPassword = Math.random().toString(36).slice(-8) + 'X@1';
        student.password = newPassword;
        await student.save();

        await sendEmail({
            to: student.email,
            subject: 'Password Reset - HS LMS',
            htmlContent: `<h1>Password Reset Success</h1><p>Your new temporary password is: <strong>${newPassword}</strong></p>`
        });

        res.json({ success: true, message: 'New password sent to student email' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteStudent = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const reqCollegeId = isAdmin ? (req.body.collegeId || req.query.collegeId || null) : req.user.collegeId;
        const query = { _id: req.params.id, role: 'student' };
        if (reqCollegeId) query.collegeId = reqCollegeId;
        const student = await User.findOneAndDelete(query);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
        res.json({ success: true, message: 'Student deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.assignCourse = async (req, res) => {
    try {
        const { courseId, batchId, divisionId } = req.body;
        
        let targetEntity;
        
        if (divisionId) {
            targetEntity = await Division.findOne({ _id: divisionId, batchId });
            if (!targetEntity) return res.status(404).json({ success: false, message: 'Division not found' });
        } else {
            targetEntity = await Batch.findOne({ _id: batchId, collegeId: req.user.collegeId });
            if (!targetEntity) return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        if (!targetEntity.courses.includes(courseId)) {
            targetEntity.courses.push(courseId);
            await targetEntity.save();
        }

        res.json({ success: true, message: `Course assigned successfully to ${divisionId ? 'Division' : 'Batch'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.removeCourseAssignment = async (req, res) => {
    try {
        const { courseId, batchId, divisionId } = req.body;
        
        let targetEntity;

        if (divisionId) {
            targetEntity = await Division.findOne({ _id: divisionId, batchId });
            if (!targetEntity) return res.status(404).json({ success: false, message: 'Division not found' });
        } else {
            targetEntity = await Batch.findOne({ _id: batchId, collegeId: req.user.collegeId });
            if (!targetEntity) return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        targetEntity.courses = targetEntity.courses.filter(id => id.toString() !== courseId.toString());
        await targetEntity.save();

        res.json({ success: true, message: 'Assignment removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAssignedCoursesByAdmin = async (req, res) => {
    try {
        const batches = await Batch.find({ collegeId: req.user.collegeId })
            .populate('courses', 'title thumbnail category description')
            .select('name batchCode courses');
        res.json({ success: true, data: batches });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const collegeId = isAdmin ? (req.query.collegeId || null) : req.user.collegeId;
        if (!isAdmin && !collegeId) return res.status(400).json({ success: false, message: 'Institutional link (collegeId) is missing. Please contact support.' });
        
        const { Test, Result } = require('../models/Exam');

        const matchStage = collegeId ? { collegeId: new mongoose.Types.ObjectId(collegeId) } : {};
        const [
            enrollmentData,
            performanceData,
            passFailStats,
            monthlyActivity
        ] = await Promise.all([
            // Students per batch
            Batch.aggregate([
                { $match: matchStage },
                { $lookup: { from: 'users', localField: '_id', foreignField: 'batchId', as: 'students' } },
                { $project: { name: 1, count: { $size: { $filter: { input: '$students', as: 's', cond: { $eq: ['$$s.role', 'student'] } } } } } }
            ]),
            // Avg score per test
            Test.aggregate([
                { $match: matchStage },
                { $lookup: { from: 'results', localField: '_id', foreignField: 'testId', as: 'results' } },
                { $project: { 
                    title: 1, 
                    avgScore: { $avg: '$results.score' } 
                } }
            ]),
            // Pass vs Fail
            Result.aggregate([
                { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
                { $unwind: '$test' },
                ...(collegeId ? [{ $match: { 'test.collegeId': new mongoose.Types.ObjectId(collegeId) } }] : []),
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            // Activity over last 6 months
            Promise.resolve([])
        ]);

        res.json({
            success: true,
            data: {
                enrollment: enrollmentData,
                performance: performanceData,
                passFail: passFailStats,
                activity: monthlyActivity
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Settings Module
exports.getSettings = async (req, res) => {
    try {
        const college = await College.findById(req.user.collegeId);
        res.json({
            success: true,
            data: {
                adminProfile: {
                    name: req.user.name,
                    email: req.user.email,
                    photo: req.user.profilePhoto
                },
                collegeInfo: college
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { name, profilePhoto, currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (name) user.name = name;
        if (profilePhoto) user.profilePhoto = profilePhoto;

        if (newPassword) {
            if (!currentPassword) return res.status(400).json({ success: false, message: 'Current password required' });
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect current password' });
            user.password = newPassword;
        }

        await user.save();
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



// ----------------------------------------------------------------
// BATCH-LEVEL COURSE ASSIGNMENT
// ----------------------------------------------------------------
exports.assignCoursesToBatch = async (req, res) => {
    try {
        const { courseIds, sectionIds, subjectIds } = req.body;
        const batch = await Batch.findOne({ _id: req.params.batchId, collegeId: req.user.collegeId });
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

        // Merge without duplicates
        if (courseIds) {
            const existingCourses = batch.courses.map(id => id.toString());
            const toAddCourses = courseIds.filter(id => !existingCourses.includes(id.toString()));
            batch.courses.push(...toAddCourses);
        }
        
        if (sectionIds) {
            const existingSections = (batch.sections || []).map(id => id.toString());
            const toAddSections = sectionIds.filter(id => !existingSections.includes(id.toString()));
            batch.sections = batch.sections || [];
            batch.sections.push(...toAddSections);
        }
        
        if (subjectIds) {
            const existingSubjects = (batch.subjects || []).map(id => id.toString());
            const toAddSubjects = subjectIds.filter(id => !existingSubjects.includes(id.toString()));
            batch.subjects = batch.subjects || [];
            batch.subjects.push(...toAddSubjects);
        }

        await batch.save();

        res.json({ success: true, message: `Assignment successful`, data: batch });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.removeCourseFromBatch = async (req, res) => {
    try {
        const { courseId } = req.body;
        const batch = await Batch.findOne({ _id: req.params.batchId, collegeId: req.user.collegeId });
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

        batch.courses = batch.courses.filter(id => id.toString() !== courseId.toString());
        await batch.save();
        res.json({ success: true, message: 'Course removed from batch' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBatchCourses = async (req, res) => {
    try {
        const { Course } = require('../models/Course');
        const batch = await Batch.findOne({ _id: req.params.batchId, collegeId: req.user.collegeId }).populate('courses');
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

        const allCourses = await Course.find({ isPublished: true }).select('title thumbnail category');
        res.json({ success: true, data: { assignedCourses: batch.courses, allCourses } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------------------------------------------------------
// DIVISION-LEVEL COURSE ASSIGNMENT
// ----------------------------------------------------------------
exports.assignCoursesToDivision = async (req, res) => {
    try {
        const { courseIds, sectionIds, subjectIds } = req.body;
        const division = await Division.findById(req.params.divisionId);
        if (!division) return res.status(404).json({ success: false, message: 'Division not found' });

        if (courseIds) {
            const existing = division.courses.map(id => id.toString());
            const toAdd = courseIds.filter(id => !existing.includes(id.toString()));
            division.courses.push(...toAdd);
        }

        if (sectionIds) {
            const existing = (division.sections || []).map(id => id.toString());
            const toAdd = sectionIds.filter(id => !existing.includes(id.toString()));
            division.sections = division.sections || [];
            division.sections.push(...toAdd);
        }

        if (subjectIds) {
            const existing = (division.subjects || []).map(id => id.toString());
            const toAdd = subjectIds.filter(id => !existing.includes(id.toString()));
            division.subjects = division.subjects || [];
            division.subjects.push(...toAdd);
        }

        await division.save();

        res.json({ success: true, message: `Assignment successful`, data: division });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.removeCourseFromDivision = async (req, res) => {
    try {
        const { courseId } = req.body;
        const division = await Division.findById(req.params.divisionId);
        if (!division) return res.status(404).json({ success: false, message: 'Division not found' });

        division.courses = division.courses.filter(id => id.toString() !== courseId.toString());
        await division.save();
        res.json({ success: true, message: 'Course removed from division' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------------------------------------------------------
// STUDENT PROGRESS (Feature 1)
// ----------------------------------------------------------------
exports.getStudentProgress = async (req, res) => {
    try {
        const { Result } = require('../models/Exam');
        const student = await User.findOne({ _id: req.params.studentId, collegeId: req.user.collegeId, role: 'student' })
            .populate('batchId', 'name batchCode')
            .populate('divisionId', 'name code');
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const results = await Result.find({ userId: student._id })
            .populate('testId', 'title')
            .sort({ createdAt: -1 });

        const avgScore = results.length > 0 
            ? Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length) 
            : 0;

        res.json({
            success: true,
            data: {
                studentInfo: student,
                stats: {
                    totalTestsTaken: results.length,
                    averageScore: avgScore,
                    lastTestDate: results[0]?.createdAt
                },
                results: results
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Course Visibility Fix
exports.getAvailableCourses = async (req, res) => {
    try {
        const college = await College.findById(req.user.collegeId).populate('allocatedCourses');
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });

        res.json({ success: true, data: college.allocatedCourses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Override existing getBatchCourses to filter by allocatedCourses
exports.getBatchCourses = async (req, res) => {
    try {
        const { Course } = require('../models/Course');
        const college = await College.findById(req.user.collegeId);
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });

        const batch = await Batch.findOne({ _id: req.params.batchId, collegeId: req.user.collegeId }).populate('courses');
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

        const allAllocatedCourses = await Course.find({ 
            _id: { $in: college.allocatedCourses },
            isPublished: true 
        }).select('title thumbnail category');

        res.json({ success: true, data: { assignedCourses: batch.courses, allCourses: allAllocatedCourses } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------------------------------------------------------
// ANNOUNCEMENTS (Feature 2)
// ----------------------------------------------------------------
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, message, targetBatchId, expiryDate, thumbnail, collegeId: bodyCollegeId } = req.body;
        if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message are required' });

        // Determine which college this announcement belongs to
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        let finalCollegeId = bodyCollegeId || req.query.collegeId || (isAdmin ? null : req.user.collegeId);

        // If it's a super admin and no collegeId provided, it's a site-wide global announcement
        if (!finalCollegeId && !isAdmin) {
            return res.status(400).json({ success: false, message: 'Institutional link (collegeId) is missing. Please select a college.' });
        }

        const announcement = await Announcement.create({
            title,
            message,
            collegeId: finalCollegeId,
            targetBatchId: targetBatchId || null,
            expiryDate: expiryDate || null,
            thumbnail: thumbnail || null,
            createdBy: req.user._id
        });
        res.status(201).json({ success: true, data: announcement });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateAnnouncement = async (req, res) => {
    try {
        const { title, message, targetBatchId, expiryDate, thumbnail } = req.body;
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        
        const query = { _id: req.params.id };
        if (!isAdmin) query.collegeId = req.user.collegeId;

        const announcement = await Announcement.findOne(query);
        if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });

        if (title) announcement.title = title;
        if (message) announcement.message = message;
        if (thumbnail !== undefined) announcement.thumbnail = thumbnail;
        if (expiryDate !== undefined) announcement.expiryDate = expiryDate;
        
        // Handle targetBatchId cleanup
        if (targetBatchId !== undefined) {
            announcement.targetBatchId = targetBatchId === "" ? null : targetBatchId;
        }

        await announcement.save();
        res.json({ success: true, data: announcement });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAnnouncements = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const collegeId = isAdmin ? (req.query.collegeId || null) : req.user.collegeId;

        const query = collegeId ? { collegeId } : { collegeId: null };
        
        const announcements = await Announcement.find(query)
            .populate('targetBatchId', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: announcements });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        const ann = await Announcement.findOneAndDelete({ _id: req.params.id, collegeId: req.user.collegeId });
        if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
        res.json({ success: true, message: 'Announcement deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------------------------------------------------------
// BULK STUDENT OPERATIONS (Feature 3)
// ----------------------------------------------------------------
exports.bulkToggleStudentStatus = async (req, res) => {
    try {
        const { studentIds, action } = req.body; // action: 'suspend' | 'activate'
        if (!studentIds || !Array.isArray(studentIds)) return res.status(400).json({ success: false, message: 'studentIds array required' });

        const newStatus = action === 'suspend' ? 'suspended' : 'active';
        const result = await User.updateMany(
            { _id: { $in: studentIds }, collegeId: req.user.collegeId, role: 'student' },
            { $set: { status: newStatus } }
        );
        res.json({ success: true, message: `${result.modifiedCount} student(s) ${newStatus}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------------------------------------------------------
// BATCH TRANSFER (Feature 4)
// ----------------------------------------------------------------
exports.transferStudentBatch = async (req, res) => {
    try {
        const { newBatchId } = req.body;
        const student = await User.findOne({ _id: req.params.studentId, collegeId: req.user.collegeId, role: 'student' });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const newBatch = await Batch.findOne({ _id: newBatchId, collegeId: req.user.collegeId });
        if (!newBatch) return res.status(404).json({ success: false, message: 'Target batch not found or not in your college' });

        const oldBatchId = student.batchId;
        student.batchId = newBatchId;
        student.divisionId = null; // Clear division since it's batch-specific
        await student.save();

        // Log the transfer
        

        res.json({ success: true, message: `Student transferred to ${newBatch.name}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------------------------------------------------------
// STUDENT ACTIVE ANNOUNCEMENTS (for student dashboard)
// ----------------------------------------------------------------
exports.getActiveAnnouncementsForStudent = async (req, res) => {
    try {
        const student = await User.findById(req.user._id);
        const now = new Date();

        const announcements = await Announcement.find({
            $and: [
                { $or: [{ collegeId: student.collegeId }, { collegeId: null }] },
                { $or: [{ targetBatchId: null }, { targetBatchId: student.batchId }] },
                { $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }] }
            ]
        }).sort({ createdAt: -1 }).limit(5);

        res.json({ success: true, data: announcements });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

