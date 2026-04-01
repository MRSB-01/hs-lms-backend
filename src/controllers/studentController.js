const User = require('../models/User');
const { Course } = require('../models/Course');
const CourseAssignment = require('../models/CourseAssignment');

exports.getAssignedCourses = async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student document not found' });
        }

        if (!student.batchId) {
            return res.status(400).json({ success: false, message: 'No batch assigned to this student. Please contact your College Admin.' });
        }

        const BatchModel = require('../models/Batch');
        const DivisionModel = require('../models/Division');

        // Fetch batch and division
        const batch = await BatchModel.findById(student.batchId).populate('courses').lean();
        let division = null;
        if (student.divisionId) {
            division = await DivisionModel.findById(student.divisionId).populate('courses').lean();
        }

        if (!batch && !division) {
            return res.json({ success: true, data: [] });
        }

        // Combine courses from batch and division
        let allCourses = [];
        if (batch && batch.courses) allCourses = [...batch.courses];
        if (division && division.courses) allCourses = [...allCourses, ...division.courses];

        // Deduplicate courses based on _id
        const uniqueCourseIds = new Set();
        const finalCourses = [];

        for (const course of allCourses) {
            if (course && course._id && !uniqueCourseIds.has(course._id.toString())) {
                uniqueCourseIds.add(course._id.toString());
                finalCourses.push(course);
            }
        }

        res.json({ success: true, data: finalCourses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCourseDetails = async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId).populate('chapters');
        res.json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
