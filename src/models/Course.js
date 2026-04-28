const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    thumbnail: { type: String },
    price: { type: Number, default: 0 },
    isFree: { type: Boolean, default: false },
    category: { type: String },
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
    instructor: { type: String },
    contentType: { type: String, enum: ['pdf', 'video'], default: 'pdf' },
    courseType: { type: String, enum: ['standard', 'structured'], default: 'standard' },
    googleDriveLink: { type: String }, // For PDF courses
    whatYouWillLearn: [{ type: String }],
    requirements: [{ type: String }],
    totalDuration: { type: Number, default: 0 }, // In minutes
    totalLectures: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    chapters: [{
        title: { type: String, required: true },
        order: { type: Number, required: true },
        pdfResource: {
            title: { type: String, default: '' },
            link: { type: String, default: '' }
        },
        lectures: [{
            title: { type: String, required: true },
            order: { type: Number, required: true },
            videoUrl: { type: String, required: true }, // Google Drive Link
            pdfResource: {
                title: { type: String, default: '' },
                link: { type: String, default: '' }
            },
            duration: { type: Number, required: true }, // In minutes
            topicsCovered: [{ type: String }],
            description: { type: String },
            isFree: { type: Boolean, default: false }
        }]
    }]
}, { timestamps: true });

const Course = mongoose.model('Course', courseSchema);

module.exports = { Course };
