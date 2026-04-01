const express = require('express');
const router = express.Router();
const { 
    getAllUsers,
    deleteUser,
    updateUser,
    getAllColleges,
    createCollege,
    updateCollege,
    deleteCollege,
    manageCourses, 
    createUser,
    getFullPlatformStats,
    getCollegeCredentials,
    changeCollegePassword,
    resetCollegePassword
} = require('../controllers/systemAdminController');
const { administratorMiddleware } = require('../middlewares/roleMiddleware');

router.use(administratorMiddleware);

// Analytics
router.get('/full-stats', getFullPlatformStats);

// User Management
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);

// College Management - Full CRUD
router.get('/colleges', getAllColleges);
router.post('/colleges', createCollege);
router.put('/colleges/:collegeId', updateCollege);
router.delete('/colleges/:collegeId', deleteCollege);
router.get('/colleges/:collegeId/credentials', getCollegeCredentials);
router.put('/colleges/:collegeId/credentials', changeCollegePassword);
router.post('/colleges/:collegeId/reset-password', resetCollegePassword);

// Course Management
router.get('/courses', manageCourses);

module.exports = router;
