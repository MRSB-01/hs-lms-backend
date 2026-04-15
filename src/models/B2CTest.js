const mongoose = require('mongoose');

const b2cQuestionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    options: [{ type: String, required: true }],
    correctOption: { type: Number, required: true },
    explanation: { type: String },
    marks: { type: Number, default: 1 }
}, { timestamps: true });

const B2C_CATEGORIES = ['Web Development', 'Programming', 'Aptitude', 'Reasoning', 'Problem Solving'];

const b2cTestSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: B2C_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    topicsCovered: [{ type: String }], // comma separated tags
    instructorName: { type: String, default: '' },
    difficultyLevel: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    examMode: { type: String, enum: ['Manual', 'AI Generated'], default: 'Manual' },
    price: { type: Number, required: true, min: 0 },
    duration: { type: Number, default: 30 }, // minutes
    status: { type: String, enum: ['active', 'disabled'], default: 'disabled' },
    testType: { type: String, enum: ['manual', 'ai-generated', 'pdf'], default: 'manual' },
    thumbnail: { type: String, default: '' },
    pdfLink: { type: String, default: '' },
    pdfDescription: { type: String, default: '' },
    pdfTopics: [{ type: String }],
    questions: [b2cQuestionSchema],
    studyMaterial: {
        pdfTitle: { type: String, default: '' },
        googleDriveLink: { type: String, default: '' }
    },
    totalQuestions: { type: Number, default: 0 },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

const b2cResultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2CTest', required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    wrongAnswers: { type: Number, default: 0 },
    percentage: { type: Number, required: true },
    status: { type: String, enum: ['pass', 'fail'], required: true },
    submissionType: { type: String, enum: ['COMPLETED', 'AUTO_SUBMITTED'], default: 'COMPLETED' },
    answers: [{
        questionId: String,
        selectedOption: Number,
        isCorrect: Boolean
    }],
    startedAt: { type: Date },
    submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const b2cPurchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2CTest', required: true },
    paymentId: { type: String, required: true },
    orderId: { type: String },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['completed', 'refunded'], default: 'completed' },
    purchasedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const B2CTest = mongoose.model('B2CTest', b2cTestSchema);
const B2CResult = mongoose.model('B2CResult', b2cResultSchema);
const B2CPurchase = mongoose.model('B2CPurchase', b2cPurchaseSchema);

module.exports = { B2CTest, B2CResult, B2CPurchase, B2C_CATEGORIES };
