const mongoose = require('mongoose');

const userPurchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, // Optional, as it could be a subject
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }, // For structured courses
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' }, // For section bundles
    paymentId: { type: String, required: true }, // Razorpay Payment ID
    amount: { type: Number, required: true },
    status: { type: String, enum: ['completed', 'refunded'], default: 'completed' }
}, { timestamps: true });

module.exports = mongoose.model('UserPurchase', userPurchaseSchema);
