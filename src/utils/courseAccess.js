/**
 * Centralized Course Access Utility
 * 
 * B2B (Free) roles: super_admin, administrator, college_admin, student
 * B2C (Paid) roles: user (individual, accountType = B2C)
 * 
 * Rules:
 * - super_admin / administrator → always accessible, no payment
 * - college_admin → accessible if their college is approved (courseAccess = 'full')
 * - student → accessible if the course is assigned to their batch (no payment)
 * - user (B2C) → accessible only if a completed UserPurchase record exists
 */

const UserPurchase = require('../models/UserPurchase');

/**
 * Determines if a user can access a specific course.
 * @param {Object} user - Mongoose User document (or plain object with role, collegeId, batchId)
 * @param {string|ObjectId} courseId - The course ID to check access against
 * @returns {Promise<{ isAccessible: boolean, requiresPayment: boolean }>}
 */
const canAccessCourse = async (user, courseId) => {
    if (!user) {
        // Unauthenticated guests cannot access; B2C users must log in and pay
        return { isAccessible: false, requiresPayment: true };
    }

    const role = user.role;

    // ── 1. Super Admin & Administrator – full free access, no payment ever ──
    if (role === 'super_admin' || role === 'administrator') {
        return { isAccessible: true, requiresPayment: false };
    }

    // ── 2. College Admin – free access ONLY to allocated courses ──
    if (role === 'college_admin') {
        const College = require('../models/College');
        const college = await College.findById(user.collegeId);
        if (college && college.status === 'approved') {
            const isAllocated = college.allocatedCourses && college.allocatedCourses.some(id => id.toString() === courseId.toString());
            console.log(`[DEBUG] College Admin Access Check: College=${college.collegeName}, CourseID=${courseId}, isAllocated=${isAllocated}`);
            return { isAccessible: isAllocated, requiresPayment: false };
        }
        // College not approved yet
        return { isAccessible: false, requiresPayment: false };
    }

    // ── 3. College Student (B2B) – free access to all college-allocated courses ──
    if (role === 'student') {
        const College = require('../models/College');

        // College must be approved first
        const college = await College.findById(user.collegeId);
        if (!college || college.status !== 'approved') {
            return { isAccessible: false, requiresPayment: false };
        }

        // Course must be in allocatedCourses for this college
        const isAllocated = college.allocatedCourses && college.allocatedCourses.some(id => id.toString() === courseId.toString());
        console.log(`[DEBUG] Student Access Check: Student=${user.name}, CourseID=${courseId}, isAllocated=${isAllocated}`);
        return { isAccessible: isAllocated, requiresPayment: false };
    }

    // ── 4. Individual User (B2C, role = 'user') – payment required ──
    if (role === 'user') {
        const purchase = await UserPurchase.findOne({
            userId: user._id,
            courseId: courseId,
            status: 'completed'
        });
        if (purchase) {
            return { isAccessible: true, requiresPayment: false };
        }
        return { isAccessible: false, requiresPayment: true };
    }

    // Fallback: deny access
    return { isAccessible: false, requiresPayment: false };
};

/**
 * Retrieves all courses accessible to a student based on their batch.
 * @param {string} studentId - The student's user ID
 * @returns {Promise<Array>} - List of courses
 */
const getStudentCourses = async (studentId) => {
    const User = require('../models/User');
    const Batch = require('../models/Batch');
    const { Course } = require('../models/Course');

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student' || !student.batchId) {
        return [];
    }

    const batch = await Batch.findById(student.batchId).populate('courses');
    return batch ? batch.courses : [];
};

module.exports = { canAccessCourse, getStudentCourses };
