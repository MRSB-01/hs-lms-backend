const mongoose = require('mongoose');

const globalAnnouncementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    thumbnail: { type: String },
    link: { type: String },
    type: { type: String, enum: ['course', 'test', 'custom'], default: 'custom' },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isActive: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('GlobalAnnouncement', globalAnnouncementSchema);
