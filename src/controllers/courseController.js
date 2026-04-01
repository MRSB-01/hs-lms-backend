const { Course } = require('../models/Course');
const UserPurchase = require('../models/UserPurchase');
const VideoProgress = require('../models/VideoProgress');
const { canAccessCourse } = require('../utils/courseAccess');
const axios = require('axios');

// Utility to generate Google Drive Embed URL
const getDriveEmbedUrl = (driveUrl) => {
    if (!driveUrl) return null;
    let fileId = '';
    
    // Format: /file/d/FILE_ID/
    const match1 = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) fileId = match1[1];
    
    // Format: ?id=FILE_ID
    const match2 = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) fileId = match2[1];
    
    // Fallback search for any 25+ char alphanumeric-dash string if matches fail
    if (!fileId) {
        const match3 = driveUrl.match(/[-\w]{25,}/);
        if (match3) fileId = match3[0];
    }
    
    if (!fileId) return null;
    return `https://drive.google.com/file/d/${fileId}/preview`;
};

// ─── GET ALL PUBLISHED COURSES (Public) ───────────────────────────────────────
exports.getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find({ isPublished: true })
            .select('-googleDriveLink')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: courses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: GET ALL COURSES including unpublished ─────────────────────────────
exports.getAdminCourses = async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.json({ success: true, data: courses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET SINGLE COURSE DETAILS (with access info) ────────────────────────────
// Returns isAccessible and requiresPayment dynamically based on the calling user's role.
exports.getCourseDetails = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).select('-googleDriveLink');
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        // Determine access for optionally-authenticated users
        let isAccessible = false;
        let requiresPayment = false;

        if (req.headers.authorization || req.cookies?.token) {
            try {
                const jwt = require('jsonwebtoken');
                const User = require('../models/User');
                let token;
                if (req.headers.authorization) token = req.headers.authorization.split(' ')[1];
                else token = req.cookies.token;

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id);
                if (user) {
                    const access = await canAccessCourse(user, req.params.id);
                    isAccessible = access.isAccessible;
                    requiresPayment = access.requiresPayment;
                }
            } catch (err) {
                // Token invalid – treat as guest
                isAccessible = false;
                requiresPayment = true; // default for guests: show buy
            }
        } else {
            // Unauthenticated guest – B2C courses require payment
            requiresPayment = true;
        }

        // Add embedUrl to lectures if content type is video
        const courseData = course.toObject();
        if (courseData.chapters && Array.isArray(courseData.chapters)) {
            courseData.chapters.forEach(chapter => {
                if (chapter.lectures && Array.isArray(chapter.lectures)) {
                    chapter.lectures.forEach(lecture => {
                        if (lecture.videoUrl) {
                            lecture.embedUrl = getDriveEmbedUrl(lecture.videoUrl);
                        }
                    });
                }
            });
        }

        res.json({
            success: true,
            data: {
                ...course._doc,
                isAccessible,
                requiresPayment
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── CREATE COURSE (admin / super_admin) ─────────────────────────────────────
exports.createCourse = async (req, res) => {
    try {
        const { title, description, price, thumbnail, googleDriveLink, category, level, instructor, contentType, whatYouWillLearn, requirements, chapters } = req.body;

        let totalDuration = 0;
        let totalLectures = 0;
        if (contentType === 'video' && chapters) {
            chapters.forEach(chapter => {
                const lectures = chapter.lectures || [];
                totalLectures += lectures.length;
                lectures.forEach(lecture => {
                    totalDuration += Number(lecture.duration) || 0;
                });
            });
        }

        const course = await Course.create({
            title,
            description,
            price: price || 0,
            thumbnail,
            googleDriveLink,
            category,
            level,
            instructor,
            contentType: contentType || 'pdf',
            whatYouWillLearn,
            requirements,
            totalDuration,
            totalLectures,
            chapters: chapters || [],
            isPublished: false // Default to false for new courses
        });
        res.status(201).json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── UPDATE COURSE ────────────────────────────────────────────────────────────
exports.updateCourse = async (req, res) => {
    try {
        const updateData = { ...req.body };

        if (updateData.contentType === 'video' && updateData.chapters) {
            let totalDuration = 0;
            let totalLectures = 0;
            updateData.chapters.forEach(chapter => {
                const lectures = chapter.lectures || [];
                totalLectures += lectures.length;
                lectures.forEach(lecture => {
                    totalDuration += Number(lecture.duration) || 0;
                });
            });
            updateData.totalDuration = totalDuration;
            updateData.totalLectures = totalLectures;
        }

        const course = await Course.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
        res.json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── DELETE COURSE ────────────────────────────────────────────────────────────
exports.deleteCourse = async (req, res) => {
    try {
        const course = await Course.findByIdAndDelete(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
        res.json({ success: true, message: 'Course deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET MY ACCESSIBLE COURSES (authenticated) ───────────────────────────────
// Returns all courses the logged-in user has access to, regardless of role.
exports.getMyPurchasedCourses = async (req, res) => {
    try {
        const user = req.user;
        let courses = [];

        if (user.role === 'super_admin' || user.role === 'administrator') {
            // Full access to ALL courses for verification
            courses = await Course.find().sort({ createdAt: -1 });

        } else if (user.role === 'college_admin') {
            const College = require('../models/College');
            const college = await College.findById(user.collegeId);
            if (college && college.status === 'approved') {
                courses = await Course.find({ isPublished: true });
            }
            // else: no courses (college not approved)

        } else if (user.role === 'student') {
            const Batch = require('../models/Batch');
            const College = require('../models/College');

            const college = await College.findById(user.collegeId);
            if (college && college.status === 'approved' && user.batchId) {
                const batch = await Batch.findById(user.batchId).populate('courses');
                courses = batch ? batch.courses : [];
            }

        } else if (user.role === 'user') {
            // B2C: only purchased courses
            const purchases = await UserPurchase.find({
                userId: user._id,
                status: 'completed'
            }).populate('courseId');
            courses = purchases.map(p => p.courseId).filter(Boolean);
        }

        res.json({ success: true, data: courses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── GET COURSE CONTENT (Google Drive link) – protected ──────────────────────
// Only returns link if user has proven access via canAccessCourse
exports.getCourseContent = async (req, res) => {
    try {
        const { isAccessible } = await canAccessCourse(req.user, req.params.id);

        if (!isAccessible) {
            return res.status(403).json({
                success: false,
                message: 'Access Denied. Purchase or get enrolled to access this course content.'
            });
        }

        const course = await Course.findById(req.params.id).select('googleDriveLink title');
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        // Log course access for student activity tracking


        res.json({ success: true, data: { googleDriveLink: course.googleDriveLink, title: course.title } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── VIDEO STREAM PROXY ───────────────────────────────────────────────────────
exports.getVideoStream = async (req, res) => {
    try {
        const { lectureId } = req.params;
        const course = await Course.findOne({ "chapters.lectures._id": lectureId });

        if (!course) return res.status(404).json({ success: false, message: 'Lecture not found' });

        // Find the lecture inside chapters
        let lecture = null;
        for (const chapter of course.chapters) {
            lecture = chapter.lectures.find(l => l._id.toString() === lectureId);
            if (lecture) break;
        }

        if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });

        // Check access: Free preview OR user has course access
        let hasAccess = lecture.isFree;
        if (!hasAccess) {
            const access = await canAccessCourse(req.user, course._id);
            hasAccess = access.isAccessible;
        }

        if (!hasAccess) {
            return res.status(403).json({ success: false, message: 'Access denied. Purchase course to watch.' });
        }

        const videoUrl = lecture.videoUrl;
        // Extract Google Drive ID
        const fileIdMatch = videoUrl.match(/(?:d\/|id=)([-\w]{25,})/) || videoUrl.match(/[-\w]{25,}/);
        if (!fileIdMatch) return res.status(400).json({ success: false, message: 'Invalid video URL' });
        const fileId = fileIdMatch[1] || fileIdMatch[0];

        // Google Drive API URL for media
        const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${process.env.GOOGLE_DRIVE_API_KEY}`;

        // Stream from Google Drive to the response
        // Handling Range requests for seeking
        const range = req.headers.range;

        const axiosConfig = {
            responseType: 'stream',
            headers: {}
        };

        if (range) {
            axiosConfig.headers.range = range;
        }

        const driveResponse = await axios.get(driveApiUrl, axiosConfig);

        // Forward headers
        res.status(driveResponse.status);
        if (driveResponse.headers['content-range']) res.setHeader('Content-Range', driveResponse.headers['content-range']);
        if (driveResponse.headers['accept-ranges']) res.setHeader('Accept-Ranges', driveResponse.headers['accept-ranges']);
        res.setHeader('Content-Length', driveResponse.headers['content-length'] || 0);
        res.setHeader('Content-Type', driveResponse.headers['content-type'] || 'video/mp4');

        driveResponse.data.pipe(res);

    } catch (error) {
        console.error("Video Stream Proxy Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            success: false, 
            message: 'Error streaming video from cloud', 
            details: error.response?.data?.error?.message || error.message 
        });
    }
};

// ─── GET LAST WATCHED PROGRESS ───────────────────────────────────────────────
exports.getLastWatchedProgress = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user._id;

        // Find the most recently watched lecture for this course
        const lastProgress = await VideoProgress.findOne({ userId, courseId })
            .sort({ lastWatchedAt: -1 });

        if (!lastProgress) {
            return res.json({ success: true, data: null });
        }

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        // Find indices
        let chapterIndex = -1;
        let lectureIndex = -1;

        for (let i = 0; i < course.chapters.length; i++) {
            const idx = course.chapters[i].lectures.findIndex(l => l._id.toString() === lastProgress.lectureId.toString());
            if (idx !== -1) {
                chapterIndex = i;
                lectureIndex = idx;
                break;
            }
        }

        res.json({
            success: true,
            data: {
                lectureId: lastProgress.lectureId,
                watchedSeconds: lastProgress.watchedSeconds,
                chapterIndex,
                lectureIndex
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── PROGRESS TRACKING ────────────────────────────────────────────────────────
exports.saveProgress = async (req, res) => {
    try {
        const { courseId, lectureId, watchedSeconds, totalSeconds } = req.body;
        const userId = req.user._id;

        const percentageWatched = (watchedSeconds / totalSeconds) * 100;
        const isCompleted = percentageWatched >= 90;

        const progress = await VideoProgress.findOneAndUpdate(
            { userId, courseId, lectureId },
            {
                watchedSeconds,
                totalSeconds,
                percentageWatched,
                lastWatchedAt: Date.now(),
                ...(isCompleted ? { isCompleted: true } : {})
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, data: progress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProgressByCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user._id;

        const progress = await VideoProgress.find({ userId, courseId });
        res.json({ success: true, data: progress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProgress = async (req, res) => {
    try {
        const { lectureId } = req.params;
        const userId = req.user._id;

        const progress = await VideoProgress.findOne({ userId, lectureId });
        res.json({ success: true, data: progress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.completeLecture = async (req, res) => {
    try {
        const { courseId, lectureId } = req.body;
        const userId = req.user._id;

        const progress = await VideoProgress.findOneAndUpdate(
            { userId, courseId, lectureId },
            { isCompleted: true, percentageWatched: 100, lastWatchedAt: Date.now() },
            { upsert: true, new: true }
        );

        res.json({ success: true, data: progress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCourseCompletionStatus = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user._id;

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        if (course.contentType === 'pdf') {
            // For PDF courses, we might still use ProgressTracking or a simple check
            // But the prompt says "This applies to both PDF courses and video courses" 
            // for the "All lectures completed" rule.
            // For now, let's assume PDF courses are considered "one lecture" or handled elsewhere.
            return res.json({ success: true, completed: true, percentage: 100 });
        }

        const totalLecturesCount = course.chapters.reduce((acc, chapter) => acc + chapter.lectures.length, 0);

        const completedLectures = await VideoProgress.find({
            userId,
            courseId,
            isCompleted: true
        });

        const completedCount = completedLectures.length;
        const percentage = totalLecturesCount > 0 ? (completedCount / totalLecturesCount) * 100 : 0;

        res.json({
            success: true,
            completed: completedCount === totalLecturesCount,
            completedCount,
            totalCount: totalLecturesCount,
            percentage
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
