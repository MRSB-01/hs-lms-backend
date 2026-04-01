const mongoose = require('mongoose');

const videoProgressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lectureId: { type: mongoose.Schema.Types.ObjectId, required: true }, // ID of the lecture in Course.chapters.lectures
    watchedSeconds: { type: Number, default: 0 },
    totalSeconds: { type: Number, required: true },
    percentageWatched: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
    lastWatchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Index for quick lookup
videoProgressSchema.index({ userId: 1, courseId: 1, lectureId: 1 }, { unique: true });

module.exports = mongoose.model('VideoProgress', videoProgressSchema);
