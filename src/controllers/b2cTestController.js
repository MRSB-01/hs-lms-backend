const { B2CTest, B2CResult, B2CPurchase, B2C_CATEGORIES } = require('../models/B2CTest');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendEmail } = require('../utils/brevo');
const { getTestResultEmail } = require('../utils/emailTemplates');

// ─── ADMIN: Create B2C Test Manually ────────────────────────────────────────
exports.createManualB2CTest = async (req, res) => {
    try {
        const {
            title, category, subject, description, topicsCovered,
            instructorName, difficultyLevel, price, duration, status, questions
        } = req.body;

        if (!B2C_CATEGORIES.includes(category)) {
            return res.status(400).json({ success: false, message: 'Invalid category' });
        }

        const test = await B2CTest.create({
            title,
            category,
            subject,
            description: description || '',
            topicsCovered: Array.isArray(topicsCovered) ? topicsCovered : [],
            instructorName: instructorName || '',
            difficultyLevel: difficultyLevel || 'Medium',
            examMode: 'Manual',
            price: Number(price) || 0,
            duration: Number(duration) || 30,
            status: status || 'disabled',
            questions: questions || [],
            totalQuestions: questions ? questions.length : 25,
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, data: test, message: 'B2C test created successfully' });
    } catch (error) {
        
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Generate AI B2C Test ────────────────────────────────────────────
exports.generateAIB2CTest = async (req, res) => {
    try {
        const {
            title, category, subject, description, difficultyLevel,
            instructorName, topicsCovered, price, duration, status
        } = req.body;

        if (!B2C_CATEGORIES.includes(category)) {
            return res.status(400).json({ success: false, message: 'Invalid category' });
        }

        if (!process.env.GEMINI_API_KEY) {
            
            return res.status(500).json({ success: false, message: 'Google Gemini API key is missing. Please check the server configuration.' });
        }
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const prompt = `Generate a 25 question multiple choice test:
Title: ${title}
Category: ${category}
Subject: ${subject}
Description: ${description}
Difficulty: ${difficultyLevel}

Requirements:
- Generate high-quality, conceptual MCQ questions appropriate for the category and difficulty.
- NO duplicate or highly similar questions.
- Ensure incorrect options are plausible distractors.

Format output EXACTLY as a raw JSON array:
[
  {
    "text": "question string",
    "options": ["option A", "option B", "option C", "option D"],
    "correctOption": 0,
    "explanation": "why the answer is correct"
  }
]
Output ONLY the JSON array. No markdown, no extra text.`;

        const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.0-flash'];
        let result = null;
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                
                const model = genAI.getGenerativeModel({ model: modelName });
                result = await model.generateContent(prompt);
                
                break;
            } catch (err) {
                lastError = err;
                
                
                if (err.status === 429 || err.message?.toLowerCase().includes('429') || err.message?.toLowerCase().includes('quota')) {
                    throw new Error('Google AI API Rate Limit reached. Pre-built test generation is currently busy. Please wait a minute and try again.');
                }
                
            }
        }

        if (!result) {
            throw new Error(`AI generation failed: ${lastError?.message || 'Unknown error'}`);
        }

        const rawContent = result.response.text();
        const startIndex = rawContent.indexOf('[');
        const endIndex = rawContent.lastIndexOf(']');

        if (startIndex === -1 || endIndex === -1) {
            throw new Error('AI returned invalid format. Try again.');
        }

        let questions;
        try {
            questions = JSON.parse(rawContent.substring(startIndex, endIndex + 1));
        } catch (e) {
            throw new Error('Failed to parse AI response. The AI output was malformed.');
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('AI generated empty question set.');
        }

        const validatedQuestions = questions.map(q => ({
            text: q.text || 'Untitled Question',
            options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
            correctOption: typeof q.correctOption === 'number' ? q.correctOption : 0,
            explanation: q.explanation || '',
            marks: 1
        }));

        const test = await B2CTest.create({
            title,
            category,
            subject,
            description: description || '',
            topicsCovered: Array.isArray(topicsCovered) ? topicsCovered : [],
            instructorName: instructorName || '',
            difficultyLevel: difficultyLevel || 'Medium',
            examMode: 'AI Generated',
            price: Number(price) || 0,
            duration: Number(duration) || 30,
            status: status || 'disabled',
            questions: validatedQuestions,
            totalQuestions: validatedQuestions.length,
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, data: test, message: 'AI test generated successfully' });
    } catch (error) {
        
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Get All B2C Tests ────────────────────────────────────────────────
exports.getAllB2CTests = async (req, res) => {
    try {
        const { category, status, examMode } = req.query;
        const filter = {};
        if (category && category !== 'all') filter.category = category;
        if (status && status !== 'all') filter.status = status;
        if (examMode && examMode !== 'all') filter.examMode = examMode;

        const tests = await B2CTest.find(filter)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: tests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Get Single B2C Test ──────────────────────────────────────────────
exports.getB2CTest = async (req, res) => {
    try {
        const test = await B2CTest.findById(req.params.testId).populate('createdBy', 'name email');
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
        res.json({ success: true, data: test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Update B2C Test ──────────────────────────────────────────────────
exports.updateB2CTest = async (req, res) => {
    try {
        const test = await B2CTest.findById(req.params.testId);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        const fields = ['title', 'category', 'subject', 'description', 'topicsCovered',
            'instructorName', 'difficultyLevel', 'price', 'duration', 'status', 'questions'];

        fields.forEach(f => {
            if (req.body[f] !== undefined) test[f] = req.body[f];
        });

        if (req.body.questions) {
            test.totalQuestions = req.body.questions.length;
        }

        await test.save();
        res.json({ success: true, data: test, message: 'Test updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Toggle B2C Test Status ──────────────────────────────────────────
exports.toggleB2CTestStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'disabled'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const test = await B2CTest.findByIdAndUpdate(
            req.params.testId,
            { status },
            { new: true }
        );
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        res.json({ success: true, data: test, message: `Test ${status === 'active' ? 'activated' : 'disabled'} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Delete B2C Test ──────────────────────────────────────────────────
exports.deleteB2CTest = async (req, res) => {
    try {
        const test = await B2CTest.findByIdAndDelete(req.params.testId);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
        res.json({ success: true, message: 'Test deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Get Test Purchases ────────────────────────────────────────────────
exports.getTestPurchases = async (req, res) => {
    try {
        const purchases = await B2CPurchase.find({ testId: req.params.testId })
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: purchases });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── USER: Browse Active B2C Tests ───────────────────────────────────────────
exports.browseB2CTests = async (req, res) => {
    try {
        const { category } = req.query;
        const filter = { status: 'active' };
        if (category && category !== 'all') filter.category = category;

        const tests = await B2CTest.find(filter)
            .select('-questions')  // Don't send questions while browsing
            .sort({ createdAt: -1 });

        // For each test, check if current user has purchased it
        const userId = req.user._id;
        const testIds = tests.map(t => t._id);
        const purchases = await B2CPurchase.find({ userId, testId: { $in: testIds }, status: 'completed' });
        const purchasedIds = new Set(purchases.map(p => p.testId.toString()));

        const testsWithPurchaseStatus = tests.map(t => ({
            ...t.toObject(),
            hasPurchased: purchasedIds.has(t._id.toString())
        }));

        res.json({ success: true, data: testsWithPurchaseStatus });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── USER: Get My Purchased Tests ────────────────────────────────────────────
exports.getMyB2CTests = async (req, res) => {
    try {
        const userId = req.user._id;
        const purchases = await B2CPurchase.find({ userId, status: 'completed' })
            .populate({ path: 'testId', select: '-questions' })
            .sort({ createdAt: -1 });

        const testIds = purchases.map(p => p.testId?._id).filter(Boolean);
        const results = await B2CResult.find({ userId, testId: { $in: testIds } }).select('testId status score percentage');
        const resultMap = {};
        results.forEach(r => { resultMap[r.testId.toString()] = r; });

        const data = purchases
            .filter(p => p.testId)
            .map(p => ({
                ...p.testId.toObject(),
                hasPurchased: true,
                purchasedAt: p.purchasedAt,
                result: resultMap[p.testId._id.toString()] || null
            }));

        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── USER: Get Single Test for Exam (with questions) ─────────────────────────
exports.getB2CTestForExam = async (req, res) => {
    try {
        const userId = req.user._id;
        const testId = req.params.testId;

        // Verify purchase
        const purchase = await B2CPurchase.findOne({ userId, testId, status: 'completed' });
        if (!purchase) {
            return res.status(403).json({ success: false, message: 'You have not purchased this test.' });
        }

        // Check if already attempted
        const existingResult = await B2CResult.findOne({ userId, testId });
        if (existingResult) {
            return res.status(400).json({ success: false, message: 'You have already attempted this test.', resultId: existingResult._id });
        }

        const test = await B2CTest.findById(testId);
        if (!test || test.status !== 'active') {
            return res.status(404).json({ success: false, message: 'Test not found or not active.' });
        }

        res.json({ success: true, data: test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── USER: Submit B2C Exam ───────────────────────────────────────────────────
exports.submitB2CExam = async (req, res) => {
    try {
        const userId = req.user._id;
        const testId = req.params.testId;
        const { answers, submissionType = 'COMPLETED', startedAt } = req.body;

        // Verify purchase
        const purchase = await B2CPurchase.findOne({ userId, testId, status: 'completed' });
        if (!purchase) return res.status(403).json({ success: false, message: 'Not purchased.' });

        // Prevent double submission
        const existingResult = await B2CResult.findOne({ userId, testId });
        if (existingResult) {
            return res.json({ success: true, data: existingResult, message: 'Already submitted.' });
        }

        const test = await B2CTest.findById(testId);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });

        // Grade exam
        const graded = (answers || []).map(ans => {
            const question = test.questions.id(ans.questionId);
            if (!question) return { ...ans, isCorrect: false };
            return {
                questionId: ans.questionId,
                selectedOption: ans.selectedOption,
                isCorrect: ans.selectedOption === question.correctOption
            };
        });

        const correctAnswers = graded.filter(a => a.isCorrect).length;
        const wrongAnswers = graded.filter(a => !a.isCorrect && a.selectedOption !== null && a.selectedOption !== undefined).length;
        const totalQuestions = test.questions.length;
        const score = correctAnswers;
        const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
        const isPassed = percentage >= 60;

        const result = await B2CResult.create({
            userId,
            testId,
            score,
            totalQuestions,
            correctAnswers,
            wrongAnswers,
            percentage,
            status: isPassed ? 'pass' : 'fail',
            submissionType,
            answers: graded,
            startedAt: startedAt ? new Date(startedAt) : null,
            submittedAt: new Date()
        });

        // Send result email
        const user = await require('../models/User').findById(userId);
        if (user?.email) {
            try {
                await sendEmail({
                    to: user.email,
                    subject: `Your Test Result is Ready - HS LMS`,
                    htmlContent: getTestResultEmail(
                        user.name,
                        test.title,
                        score,
                        totalQuestions,
                        percentage,
                        correctAnswers,
                        wrongAnswers,
                        isPassed
                    )
                });
            } catch (emailErr) {
                
            }
        }

        res.json({ success: true, data: result, message: 'Exam submitted successfully' });
    } catch (error) {
        
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── USER: Get B2C Exam Result ───────────────────────────────────────────────
exports.getB2CResult = async (req, res) => {
    try {
        const userId = req.user._id;
        const result = await B2CResult.findOne({ userId, testId: req.params.testId })
            .populate('testId', 'title category subject difficultyLevel duration');
        if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── PAYMENT: Grant B2C Test Access ──────────────────────────────────────────
exports.grantB2CTestAccess = async (userId, testId, paymentId, orderId, amount) => {
    try {
        const existing = await B2CPurchase.findOne({ userId, testId, status: 'completed' });
        if (existing) return;

        await B2CPurchase.create({ userId, testId, paymentId, orderId, amount, status: 'completed', purchasedAt: new Date() });
        return true;
    } catch (error) {
        
        throw error;
    }
};

// ─── PAYMENT: Check B2C Test Purchase ────────────────────────────────────────
exports.checkB2CTestPurchase = async (userId, testId) => {
    return await B2CPurchase.findOne({ userId, testId, status: 'completed' });
};

module.exports = exports;
