const express = require('express');
const router = express.Router();
const { 
    getAssignedCourses, 
    getCourseDetails 
} = require('../controllers/studentController');
const {
    getStudentTests,
    startTest,
    submitStudentTest
} = require('../controllers/studentTestController');
const { studentMiddleware } = require('../middlewares/roleMiddleware');

router.use(studentMiddleware);

router.get('/courses', getAssignedCourses);
router.get('/courses/:courseId', getCourseDetails);

router.get('/tests', getStudentTests);
router.post('/tests/start', startTest);
router.post('/tests/submit', submitStudentTest);

module.exports = router;
