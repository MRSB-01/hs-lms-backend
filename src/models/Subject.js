const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    topicsCovered: [{ type: String }],
    price: { type: Number, required: true, default: 0 },
    contentType: { type: String, enum: ['pdf', 'video'], default: 'pdf' },
    contentLink: { type: String }, // For PDF courses, or maybe one Drive link
    lectures: [{
        title: { type: String, required: true },
        videoUrl: { type: String, required: true },
        duration: { type: Number, required: true },
        topicsCovered: [{ type: String }],
        description: { type: String }
    }],
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true }
}, { timestamps: true });

const Subject = mongoose.model('Subject', subjectSchema);

module.exports = { Subject };
