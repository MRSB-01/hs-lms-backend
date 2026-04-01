const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
    collegeName: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
    code: { type: String, unique: true, sparse: true }, // Internal code for identification
    contactEmail: { type: String, required: true },
    contactPhone: { type: String },
    address: { type: String },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    courseAccess: { type: String, enum: ['none', 'full', 'basic'], default: 'none' },
    allocatedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    generatedPassword: { type: String, default: null }, // Plain-text password stored for Super Admin reference
}, { timestamps: true });

module.exports = mongoose.model('College', collegeSchema);
