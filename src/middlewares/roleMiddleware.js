const { protect, authorize } = require('./auth');

// Administrator and Super Admin: Full control over the entire system
const administratorMiddleware = [protect, authorize('administrator', 'super_admin')];

// Super Admin and Administrator
const superAdminMiddleware = [protect, authorize('administrator', 'super_admin')];

// College Admin: Manages internal LMS for their college
const collegeAdminMiddleware = [protect, authorize('college_admin', 'administrator', 'super_admin')];

// Student: Access assigned courses
const studentMiddleware = [protect, authorize('student', 'administrator', 'super_admin')];

// Individual User: Standard platform user
const userMiddleware = [protect, authorize('user', 'administrator', 'super_admin')];

module.exports = {
    administratorMiddleware,
    superAdminMiddleware,
    collegeAdminMiddleware,
    studentMiddleware,
    userMiddleware
};
