const mongoose = require('mongoose');

const divisionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    code: { type: String, unique: true, sparse: true }, // Division code for student login
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }]
}, { timestamps: true });

module.exports = mongoose.model('Division', divisionSchema);
