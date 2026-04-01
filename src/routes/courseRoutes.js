const express = require('express');
const router = express.Router();
const {
    createCourse,
    getAllCourses,
    getAdminCourses,
    getCourseDetails,
    updateCourse,
    deleteCourse,
    getMyPurchasedCourses,
    getCourseContent,
    getVideoStream,
    saveProgress,
    getProgress,
    completeLecture,
    getCourseCompletionStatus,
    getLastWatchedProgress,
    getProgressByCourse
} = require('../controllers/courseController');
const { protect, authorize } = require('../middlewares/auth');

// ─── Static / named routes MUST come before /:id wildcard routes ─────────────

// Public – all published courses listing
router.get('/', getAllCourses);

// Authenticated – my accessible courses (B2B + B2C combined)
router.get('/my-purchases', protect, getMyPurchasedCourses);

// Admin – all courses including unpublished
router.get('/admin/all', protect, authorize('administrator', 'super_admin'), getAdminCourses);

// Video streaming proxy
router.get('/video-stream/:lectureId', protect, getVideoStream);

// Progress tracking
router.post('/progress/save', protect, saveProgress);
router.get('/progress/last-watched/:courseId', protect, getLastWatchedProgress);
router.get('/progress/course/:courseId', protect, getProgressByCourse);
router.get('/progress/:lectureId', protect, getProgress);
router.post('/progress/complete', protect, completeLecture);
router.get('/completion-status/:courseId', protect, getCourseCompletionStatus);

// Admin – CRUD
router.post('/', protect, authorize('administrator', 'super_admin'), createCourse);

// ─── Wildcard /:id routes MUST come LAST ─────────────────────────────────────

// Public – single course detail (with dynamic access info if token present)
router.get('/:id', getCourseDetails);

// Authenticated – course content (Google Drive link)
router.get('/:id/content', protect, getCourseContent);

// Admin – update / delete
router.put('/:id', protect, authorize('administrator', 'super_admin'), updateCourse);
router.delete('/:id', protect, authorize('administrator', 'super_admin'), deleteCourse);

module.exports = router;
