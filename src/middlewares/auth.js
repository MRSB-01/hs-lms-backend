const envConfig = require('../config/envConfig');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
        token = req.cookies.token;
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    try {
        const decoded = jwt.verify(token, envConfig.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(401).json({ success: false, message: 'User not found' });
        
        // Update lastSeen (throttle to once per minute to save DB writes)
        const now = new Date();
        if (!user.lastSeen || (now - user.lastSeen) > 60000) {
            user.lastSeen = now;
            await user.save();
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `User role ${req.user.role} is not authorized to access this route` 
            });
        }
        next();
    };
};

const administratorOnly = authorize('administrator');
const superAdminOnly = authorize('super_admin');
const collegeAdminOnly = authorize('college_admin');
const studentOnly = authorize('student');

module.exports = { 
    protect, 
    authorize,
    administratorOnly,
    superAdminOnly,
    collegeAdminOnly,
    studentOnly
};
