const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { 
    getDashboardStats,
    createBatch, 
    getBatches, 
    updateBatch,
    deleteBatch,
    createDivision, 
    getDivisions,
    updateDivision,
    deleteDivision,
    addStudent, 
    bulkImportStudents,
    getStudents,
    updateStudent,
    deleteStudent,
    toggleStudentStatus,
    resetStudentPassword,
    assignCourse, 
    removeCourseAssignment,
    getAssignedCoursesByAdmin,
    getAnalytics,
    getSettings,
    updateSettings,
    // New endpoints
    assignCoursesToBatch,
    removeCourseFromBatch,
    getBatchCourses,
    assignCoursesToDivision,
    removeCourseFromDivision,
    getStudentProgress,
    createAnnouncement,
    updateAnnouncement,
    getAnnouncements,
    deleteAnnouncement,
    bulkToggleStudentStatus,
    transferStudentBatch,
    getActiveAnnouncementsForStudent,
    getAvailableCourses
} = require('../controllers/collegeAdminController');
const { collegeAdminMiddleware } = require('../middlewares/roleMiddleware');
const { studentMiddleware } = require('../middlewares/roleMiddleware');

const {
    createManualTest,
    generateAITest,
    getTests,
    getTest,
    updateTest,
    deleteTest,
    getTestResults,
    publishTestResults,
    updateTestStatus
} = require('../controllers/collegeTestController');

router.use(collegeAdminMiddleware);
router.get('/dashboard-stats', getDashboardStats);

// Tests Module
router.post('/tests/manual', createManualTest);
router.post('/tests/ai-generate', generateAITest);
router.get('/tests', getTests);
router.get('/tests/:testId', getTest);
router.put('/tests/:testId', updateTest);
router.delete('/tests/:testId', deleteTest);
router.get('/tests/:testId/results', getTestResults);
router.post('/tests/:testId/publish', publishTestResults);
router.patch('/tests/:testId/status', updateTestStatus);

// Batch Management
router.post('/batches', createBatch);
router.get('/batches', getBatches);
router.put('/batches/:batchId', updateBatch);
router.delete('/batches/:batchId', deleteBatch);

// Batch-Level Course Assignment
router.get('/batches/:batchId/courses', getBatchCourses);
router.post('/batches/:batchId/assign-courses', assignCoursesToBatch);
router.post('/batches/:batchId/remove-course', removeCourseFromBatch);

// Division Management (with batchId context)
router.get('/batches/:batchId/divisions', getDivisions);
router.post('/divisions', createDivision);
router.put('/divisions/:divisionId', updateDivision);
router.delete('/divisions/:divisionId', deleteDivision);

// Division-Level Course Assignment
router.post('/divisions/:divisionId/assign-courses', assignCoursesToDivision);
router.post('/divisions/:divisionId/remove-course', removeCourseFromDivision);

// Student Management
router.post('/add-student', addStudent);
router.post('/bulk-import-students', upload.single('file'), bulkImportStudents);
router.get('/students', getStudents);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);
router.patch('/students/:id/toggle-status', toggleStudentStatus);
router.post('/students/:id/reset-password', resetStudentPassword);
router.get('/students/:studentId/progress', getStudentProgress);
router.post('/students/:studentId/transfer-batch', transferStudentBatch);
router.post('/students/bulk-status', bulkToggleStudentStatus);

// Course Assignment (Legacy single-course)
router.post('/assign-course', assignCourse);
router.post('/remove-course-assignment', removeCourseAssignment);
router.get('/assigned-courses', getAssignedCoursesByAdmin);

// Announcements
router.get('/announcements', getAnnouncements);
router.post('/announcements', createAnnouncement);
router.put('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

// Analytics & Settings
router.get('/analytics', getAnalytics);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);


module.exports = router;
