const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
    batchCode: { type: String, unique: true, required: true }, // MCA25A-X9K2
    programName: { type: String, required: true }, // MCA, BCA etc.
    year: { type: String, required: true }, // 2025
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }]
}, { timestamps: true });

module.exports = mongoose.model('Batch', batchSchema);
