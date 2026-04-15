const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null }, // null = site-wide global announcement
    targetBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null }, // null = all batches
    expiryDate: { type: Date, default: null },
    thumbnail: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
