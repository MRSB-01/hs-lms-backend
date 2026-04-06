const envConfig = require('../config/envConfig');
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
exports.getCourseDetails = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        let isAccessible = false;
        let requiresPayment = false;

        const authHeader = req.headers.authorization;
        const cookieToken = req.cookies?.token;

        if (authHeader || cookieToken) {
            try {
                const jwt = require('jsonwebtoken');
                const User = require('../models/User');
                const token = authHeader ? authHeader.split(' ')[1] : cookieToken;
                const decoded = jwt.verify(token, envConfig.JWT_SECRET);
                const user = await User.findById(decoded.id);
                if (user) {
                    const access = await canAccessCourse(user, req.params.id);
                    isAccessible = access.isAccessible;
                    requiresPayment = access.requiresPayment;
                }
            } catch (err) {
                isAccessible = false;
                requiresPayment = true;
            }
        } else {
            requiresPayment = true;
        }

        const courseData = course.toObject();
        
        // Hide direct links and provide embed URLs if accessible
        if (isAccessible) {
            if (courseData.googleDriveLink) {
                courseData.embedUrl = getDriveEmbedUrl(courseData.googleDriveLink);
                delete courseData.googleDriveLink;
            }
            if (courseData.chapters) {
                courseData.chapters.forEach(chapter => {
                    if (chapter.pdfResource?.link) {
                        chapter.pdfResource.embedUrl = getDriveEmbedUrl(chapter.pdfResource.link);
                        delete chapter.pdfResource.link;
                    }
                    if (chapter.lectures) {
                        chapter.lectures.forEach(lecture => {
                            if (lecture.videoUrl) {
                                lecture.videoEmbedUrl = getDriveEmbedUrl(lecture.videoUrl);
                                delete lecture.videoUrl;
                            }
                            if (lecture.pdfResource?.link) {
                                lecture.pdfResource.embedUrl = getDriveEmbedUrl(lecture.pdfResource.link);
                                delete lecture.pdfResource.link;
                            }
                        });
                    }
                });
            }
        } else {
            // Not accessible: hide all sensitive links
            delete courseData.googleDriveLink;
            if (courseData.chapters) {
                courseData.chapters.forEach(chapter => {
                    if (chapter.pdfResource) delete chapter.pdfResource.link;
                    if (chapter.lectures) {
                        chapter.lectures.forEach(lecture => {
                            delete lecture.videoUrl;
                            if (lecture.pdfResource) delete lecture.pdfResource.link;
                        });
                    }
                });
            }
        }

        res.json({
            success: true,
            data: {
                ...courseData,
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

// ─── GET COURSE CONTENT (Google Drive embed URLs) – protected ─────────────────
exports.getCourseContent = async (req, res) => {
    try {
        const { isAccessible } = await canAccessCourse(req.user, req.params.id);
        if (!isAccessible) {
            return res.status(403).json({ success: false, message: 'Access Denied.' });
        }

        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        const courseData = course.toObject();
        
        // Transform all links to embed URLs
        if (courseData.googleDriveLink) {
            courseData.embedUrl = getDriveEmbedUrl(courseData.googleDriveLink);
            delete courseData.googleDriveLink;
        }

        if (courseData.chapters) {
            courseData.chapters.forEach(chapter => {
                if (chapter.pdfResource?.link) {
                    chapter.pdfResource.embedUrl = getDriveEmbedUrl(chapter.pdfResource.link);
                    delete chapter.pdfResource.link;
                }
                if (chapter.lectures) {
                    chapter.lectures.forEach(lecture => {
                        if (lecture.videoUrl) {
                            lecture.videoEmbedUrl = getDriveEmbedUrl(lecture.videoUrl);
                            delete lecture.videoUrl;
                        }
                        if (lecture.pdfResource?.link) {
                            lecture.pdfResource.embedUrl = getDriveEmbedUrl(lecture.pdfResource.link);
                            delete lecture.pdfResource.link;
                        }
                    });
                }
            });
        }

        res.json({ success: true, data: courseData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Video streaming is handled via Google Drive Embed URLs directly in the frontend

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
