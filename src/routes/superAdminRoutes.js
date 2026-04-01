const express = require('express');
const router = express.Router();
const { 
    getDashboardStats,
    getCollegeRequests,
    approveCollegeRequest, 
    getSalesSummary, 
    getAllColleges,
    createCollege,
    updateCollege,
    deleteCollege,
    toggleCollegeStatus,
    getCollegeCredentials,
    changeCollegePassword,
    resetCollegePassword,
    getAllExams,
    toggleExamStatus,
    getAllUsersByRole,
    toggleUserStatus,
    deleteUserPermanently,
    getAllDivisions,
    deleteDivision,
    getAllBatches,
    deleteBatch,
    getPaymentsReport,
    allocateCourses,
    getAllocatedCourses
} = require('../controllers/superAdminController');
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
const { superAdminMiddleware } = require('../middlewares/roleMiddleware');

router.use(superAdminMiddleware);

// Analytics
router.get('/dashboard-stats', getDashboardStats);
router.get('/sales/summary', getSalesSummary);

// College Request Management
router.get('/college-requests', getCollegeRequests);
router.post('/college-requests/approve/:collegeId', approveCollegeRequest);

// Full Colleges Management (CRUD)
router.get('/colleges', getAllColleges);
router.post('/colleges', createCollege);
router.put('/colleges/:collegeId', updateCollege);
router.delete('/colleges/:collegeId', deleteCollege);
router.patch('/colleges/:collegeId/status', toggleCollegeStatus);
router.get('/colleges/:collegeId/credentials', getCollegeCredentials);
router.put('/colleges/:collegeId/credentials', changeCollegePassword);
router.post('/colleges/:collegeId/reset-password', resetCollegePassword);
router.post('/colleges/:collegeId/allocate-courses', allocateCourses);
router.get('/colleges/:collegeId/allocated-courses', getAllocatedCourses);

// Exams Management
router.get('/exams', getAllExams);
router.patch('/exams/:examId/status', toggleExamStatus);

// Common Tests Module (Reuse College Controller)
router.post('/tests/manual', createManualTest);
router.post('/tests/ai-generate', generateAITest);
router.get('/tests', getTests);
router.get('/tests/:testId', getTest);
router.put('/tests/:testId', updateTest);
router.delete('/tests/:testId', deleteTest);
router.get('/tests/:testId/results', getTestResults);
router.post('/tests/:testId/publish', publishTestResults);
router.patch('/tests/:testId/status', updateTestStatus);

// Users Management (Students & B2C)
router.get('/users-by-role', getAllUsersByRole);
router.patch('/users/:userId/status', toggleUserStatus);
router.post('/users/:userId/delete', deleteUserPermanently);

// Divisions & Batches
router.get('/divisions', getAllDivisions);
router.delete('/divisions/:divisionId', deleteDivision);
router.get('/batches', getAllBatches);
router.delete('/batches/:batchId', deleteBatch);

// Activity Logs


// Revenue Reports
router.get('/revenue-report', getPaymentsReport);

module.exports = router;
