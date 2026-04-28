const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    bundleDiscountPercentage: { type: Number, default: 0 }
}, { timestamps: true });

const Section = mongoose.model('Section', sectionSchema);

module.exports = { Section };
