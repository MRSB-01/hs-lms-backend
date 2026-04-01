const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    lastWatchedLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    progressPercentage: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date }
}, { timestamps: true });

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' }, // Added for B2C Test payments
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    itemType: { type: String, enum: ['course', 'test'], default: 'course' }
}, { timestamps: true });

// Specific collection for easy access control monitoring
const testPurchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    paymentId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['completed', 'refunded'], default: 'completed' }
}, { timestamps: true });

const ProgressTracking = mongoose.model('ProgressTracking', progressSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const TestPurchase = mongoose.model('TestPurchase', testPurchaseSchema);

module.exports = { ProgressTracking, Payment, TestPurchase };
