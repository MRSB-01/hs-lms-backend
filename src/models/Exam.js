const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    description: { type: String }, // Optional description below text
    image: { type: String }, // Optional image upload (URL or base64)
    options: [{ type: String, required: true }],
    correctOption: { type: Number, required: true }, // Index of the correct option
    explanation: { type: String },
    marks: { type: Number, default: 1 }
}, { timestamps: true });

const testSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String },
    description: { type: String },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College' }, // Added college reference
    assignedBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }], // Array of batch IDs
    password: { type: String }, // Secure test password
    startTime: { type: Date }, // Window start
    endTime: { type: Date }, // Window end
    isPublished: { type: Boolean, default: false }, // Are results published?
    isAI: { type: Boolean, default: false }, // Useful to track AI vs Manual
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }, // Optional: Test per chapter
    questions: [questionSchema],
    duration: { type: Number, required: true, default: 30 }, // In minutes
    passingMarks: { type: Number, required: true, default: 10 },
    totalMarks: { type: Number, required: true, default: 25 },
    status: { type: String, enum: ['active', 'disabled'], default: 'disabled' },
    price: { type: Number, default: 0 }, // For B2C
    createdBy: { 
        type: String, 
        enum: ['SUPER_ADMIN', 'COLLEGE_ADMIN'], 
        required: true, 
        default: 'SUPER_ADMIN' 
    },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' }
}, { timestamps: true });

const resultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    incorrectAnswers: { type: Number, default: 0 },
    status: { type: String, enum: ['pass', 'fail'], required: true },
    submissionType: { type: String, enum: ['COMPLETED', 'AUTO_SUBMITTED'], default: 'COMPLETED' },
    answers: [{ 
        questionId: String, 
        selectedOption: Number, 
        selectedOptionString: String,
        isCorrect: Boolean 
    }],
    monitoringLogs: [{
        event: String,
        timestamp: { type: Date, default: Date.now }
    }],
    startTime: { type: Date },
    completedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Test = mongoose.model('Test', testSchema);
const Result = mongoose.model('Result', resultSchema);

module.exports = { Test, Result };
