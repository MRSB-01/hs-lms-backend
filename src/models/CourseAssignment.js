const mongoose = require('mongoose');

const courseAssignmentSchema = new mongoose.Schema({
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // College Admin
}, { timestamps: true });

// Ensure either batchId or divisionId is present
courseAssignmentSchema.pre('save', function(next) {
    if (!this.batchId && !this.divisionId) {
        next(new Error('Course must be assigned to either a Batch or a Division'));
    } else {
        next();
    }
});

module.exports = mongoose.model('CourseAssignment', courseAssignmentSchema);
