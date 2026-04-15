const { B2CTest, B2CResult, B2CPurchase, B2C_CATEGORIES } = require('../models/B2CTest');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendEmail } = require('../utils/brevo');
const { getTestResultEmail } = require('../utils/emailTemplates');

// ─── ADMIN: Create B2C Test Manually ────────────────────────────────────────
exports.createManualB2CTest = async (req, res) => {
    try {
        const {
            title, category, subject, description, topicsCovered,
            instructorName, difficultyLevel, price, duration, status, questions, studyMaterial,
            testType, thumbnail, pdfLink, pdfDescription, pdfTopics
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
            examMode: testType === 'pdf' ? 'Manual' : 'Manual',
            price: Number(price) || 0,
            duration: Number(duration) || 30,
            status: status || 'disabled',
            testType: testType || 'manual',
            thumbnail: thumbnail || '',
            pdfLink: pdfLink || '',
            pdfDescription: pdfDescription || '',
            pdfTopics: Array.isArray(pdfTopics) ? pdfTopics : [],
            questions: questions || [],
            studyMaterial: studyMaterial || { pdfTitle: '', googleDriveLink: '' },
            totalQuestions: testType === 'pdf' ? (Number(req.body.totalQuestions) || 0) : (questions ? questions.length : 0),
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
            instructorName, topicsCovered, price, duration, status, studyMaterial,
            thumbnail
        } = req.body;

        if (!B2C_CATEGORIES.includes(category)) {
            return res.status(400).json({ success: false, message: 'Invalid category' });
        }

        let validQuestions = [];
        let aiSuccess = false;
        const TARGET_COUNT = 30;

        // 1. Database Mix Strategy: Try to pull some relevant questions first to seed
        const existingTests = await B2CTest.find({ category, subject: { $regex: new RegExp(subject, 'i') } })
            .sort({ createdAt: -1 })
            .limit(3);
        
        let dbPool = [];
        existingTests.forEach(t => {
            if (t.questions && t.questions.length > 0) dbPool = [...dbPool, ...t.questions];
        });

        // Unique by question text
        const uniqueDbPool = Array.from(new Map(dbPool.map(q => [q.text.toLowerCase().trim(), q])).values());
        
        // Take up to 10 existing questions to mix in
        if (uniqueDbPool.length > 0) {
            validQuestions = uniqueDbPool.sort(() => 0.5 - Math.random()).slice(0, 10).map(q => ({
                text: q.text,
                options: q.options,
                correctOption: q.correctOption,
                explanation: q.explanation || '',
                marks: 1
            }));
        }

        // 2. AI Generation Cycle (Iterative until TARGET_COUNT is reached)
        if (process.env.GEMINI_API_KEY && validQuestions.length < TARGET_COUNT) {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro', 'gemini-pro'];
            
            let currentModelIdx = 0;
            let attempts = 0;
            const maxAttempts = 5;

            while (validQuestions.length < TARGET_COUNT && attempts < maxAttempts) {
                attempts++;
                const neededCount = TARGET_COUNT - validQuestions.length;
                const modelName = modelsToTry[currentModelIdx % modelsToTry.length];
                
                const prompt = `Task: Generate ${neededCount} High-Quality, Relevant MCQ assessment questions.
Strict Requirements:
1. Subject: ${subject}
2. Context/Topics: ${topicsCovered || description || title}
3. Difficulty: ${difficultyLevel}
4. Format: Strictly return a JSON array of objects.
5. Randomize Answers: The correct answer (0-3) MUST be randomly distributed across Options A, B, C, and D. Do NOT use the same correct index for all questions.
6. Options: Provide 4 distinct and plausible options for each question.
7. NO Duplicates: Do not repeat any concepts or questions.

Output Format (Example):
[
  {
    "text": "The actual question relating to ${subject}...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOption": 1, 
    "explanation": "Reference to the concept..."
  }
]
Output ONLY the raw JSON array. No markdown, no introductory text.`;

                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(prompt);
                    const rawContent = result.response.text();
                    
                    const startIndex = rawContent.indexOf('[');
                    const endIndex = rawContent.lastIndexOf(']');

                    if (startIndex !== -1 && endIndex !== -1) {
                        const parsed = JSON.parse(rawContent.substring(startIndex, endIndex + 1));
                        if (Array.isArray(parsed)) {
                            const newQs = parsed
                                .filter(q => q.text && Array.isArray(q.options) && q.options.length === 4)
                                .map(q => ({
                                    text: q.text,
                                    options: q.options,
                                    correctOption: typeof q.correctOption === 'number' ? q.correctOption % 4 : Math.floor(Math.random() * 4),
                                    explanation: q.explanation || '',
                                    marks: 1
                                }));
                            
                            // Prevent duplicates from new generated set
                            newQs.forEach(nq => {
                                if (!validQuestions.some(vq => vq.text.toLowerCase().trim() === nq.text.toLowerCase().trim())) {
                                    validQuestions.push(nq);
                                }
                            });
                            
                            aiSuccess = true;
                        }
                    }
                } catch (err) {
                    currentModelIdx++; // Failover: Try next model
                }
            }
        }

        // 3. Last Resort Fallback: If still under TARGET_COUNT, duplicate pool with shuffles or use generic bank
        if (validQuestions.length < TARGET_COUNT) {
            const genericBank = [
                { text: `What is the primary core concept behind ${subject}?`, options: ["Abstraction", "Inheritance", "Process Workflow", "Data Governance"], correctOption: 2 },
                { text: `Which methodology is most effective for ${subject} implementation?`, options: ["Agile/Iterative", "Strict Waterfall", "Ad-hoc Execution", "Manual Overload"], correctOption: 0 },
                { text: `What is a common challenge encountered in ${subject}?`, options: ["Scalability issues", "Predictable outcomes", "Resource abundance", "Low maintenance"], correctOption: 0 },
                { text: `Which best practice is essential for success in ${subject}?`, options: ["Bypassing security", "Continuous validation", "Hardcoding values", "Minimal testing"], correctOption: 1 },
                { text: `How does ${subject} impact overall system reliability?`, options: ["Provides stability", "Increases failure rate", "No impact", "Reduces performance"], correctOption: 0 }
            ];

            let bankIdx = 0;
            while (validQuestions.length < TARGET_COUNT) {
                const item = genericBank[bankIdx % genericBank.length];
                validQuestions.push({
                    ...item,
                    explanation: `Generic conceptual fallback for ${subject}.`,
                    marks: 1
                });
                bankIdx++;
            }
        }

        // 4. Final Answer Randomization Sanity Check (Shuffle everything)
        validQuestions = validQuestions.sort(() => 0.5 - Math.random());
        // For questions where AI might have been lazy (all A), reshuffle options
        validQuestions.forEach(q => {
            // Internal shuffle of options and update correctOption
            const indexedOptions = q.options.map((o, i) => ({ text: o, isCorrect: i === q.correctOption }));
            const shuffled = indexedOptions.sort(() => 0.5 - Math.random());
            q.options = shuffled.map(s => s.text);
            q.correctOption = shuffled.findIndex(s => s.isCorrect);
        });

        // 5. Create Test
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
            testType: 'ai-generated',
            thumbnail: thumbnail || '',
            pdfLink: '',
            questions: validQuestions.slice(0, 30), // Ensure exactly 30
            studyMaterial: studyMaterial || { pdfTitle: '', googleDriveLink: '' },
            totalQuestions: 30,
            createdBy: req.user._id
        });

        res.status(201).json({ 
            success: true, 
            data: test, 
            message: `Test generated successfully with ${test.totalQuestions} randomized questions.`
        });

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

        const testsProcessed = tests.map(t => {
            const testObj = t.toObject();
            if (testObj.thumbnail) testObj.thumbnail = getDriveDirectLink(testObj.thumbnail);
            return testObj;
        });

        res.json({ success: true, data: testsProcessed });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Get Single B2C Test ──────────────────────────────────────────────
exports.getB2CTest = async (req, res) => {
    try {
        const test = await B2CTest.findById(req.params.testId).populate('createdBy', 'name email');
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
        
        const testObj = test.toObject();
        if (testObj.thumbnail) testObj.thumbnail = getDriveDirectLink(testObj.thumbnail);
        
        res.json({ success: true, data: testObj });
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
            'instructorName', 'difficultyLevel', 'price', 'duration', 'status', 'questions', 'testType', 'thumbnail', 'pdfLink', 'pdfDescription', 'pdfTopics'];

        fields.forEach(f => {
            if (req.body[f] !== undefined) test[f] = req.body[f];
        });

        if (req.body.questions) {
            test.totalQuestions = test.testType === 'pdf' ? (Number(req.body.totalQuestions) || test.totalQuestions) : req.body.questions.length;
        } else if (req.body.totalQuestions !== undefined) {
            test.totalQuestions = Number(req.body.totalQuestions);
        }

        if (req.body.studyMaterial) {
            test.studyMaterial = req.body.studyMaterial;
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

// ─── ADMIN: Save Single Question ───────────────────────────────────────────
exports.saveB2CQuestion = async (req, res) => {
    try {
        const { testId } = req.params;
        const { question, questionId } = req.body; 

        const test = await B2CTest.findById(testId);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        if (questionId) {
            // Edit existing question
            const qIndex = test.questions.findIndex(q => q._id.toString() === questionId);
            if (qIndex === -1) return res.status(404).json({ success: false, message: 'Question not found' });
            test.questions[qIndex] = { ...test.questions[qIndex].toObject(), ...question };
        } else {
            // Add new question
            test.questions.push(question);
        }

        test.totalQuestions = test.questions.length;
        await test.save();

        const savedQuestion = questionId ? test.questions.find(q => q._id.toString() === questionId) : test.questions[test.questions.length - 1];

        res.json({ success: true, data: savedQuestion, totalSaved: test.questions.length, message: 'Question saved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── UTILITY: Get Drive Embed URL ──────────────────────────────────────────
const getDriveEmbedUrl = (driveUrl) => {
    if (!driveUrl) return null;
    let fileId = '';
    const match1 = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) fileId = match1[1];
    const match2 = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) fileId = match2[1];
    if (!fileId) {
        const match3 = driveUrl.match(/[-\w]{25,}/);
        if (match3) fileId = match3[0];
    }
    if (!fileId) return null;
    return `https://drive.google.com/file/d/${fileId}/preview`;
};

const getDriveDirectLink = (driveUrl) => {
    if (!driveUrl || !driveUrl.includes('drive.google.com')) return driveUrl;
    let fileId = '';
    const match1 = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) fileId = match1[1];
    const match2 = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) fileId = match2[1];
    if (!fileId) {
        const match3 = driveUrl.match(/[-\w]{25,}/);
        if (match3) fileId = match3[0];
    }
    if (!fileId) return driveUrl;
    // return `https://drive.google.com/uc?export=view&id=${fileId}`;
    return `https://lh3.googleusercontent.com/d/${fileId}`; // More reliable for direct images
};

// ─── USER: Browse Active B2C Tests ───────────────────────────────────────────
exports.browseB2CTests = async (req, res) => {
    try {
        const { category } = req.query;
        const filter = { status: 'active' };
        if (category && category !== 'all') filter.category = category;

        const tests = await B2CTest.find(filter)
            .select('-questions')
            .sort({ createdAt: -1 });

        // For each test, check if current user has purchased it
        const userId = req.user ? req.user._id : null;
        let purchasedIds = new Set();
        
        if (userId) {
            const testIds = tests.map(t => t._id);
            const B2CPurchase = require('../models/B2CPurchase');
            const purchases = await B2CPurchase.find({ userId, testId: { $in: testIds }, status: 'completed' });
            purchasedIds = new Set(purchases.map(p => p.testId.toString()));
        }

        const testsWithPurchaseStatus = tests.map(t => {
            const testObj = t.toObject();
            if (testObj.thumbnail) {
                testObj.thumbnail = getDriveDirectLink(testObj.thumbnail);
            }
            if (userId && purchasedIds.has(t._id.toString())) {
                testObj.hasPurchased = true;
                if (testObj.studyMaterial?.googleDriveLink) {
                    testObj.studyMaterial.embedUrl = getDriveEmbedUrl(testObj.studyMaterial.googleDriveLink);
                    delete testObj.studyMaterial.googleDriveLink;
                }
                if (testObj.testType === 'pdf' && testObj.pdfLink) {
                    testObj.pdfEmbedUrl = getDriveEmbedUrl(testObj.pdfLink);
                    delete testObj.pdfLink;
                }
            } else {
                testObj.hasPurchased = false;
                delete testObj.studyMaterial; // Hide completely if not purchased
                delete testObj.pdfLink; // Hide completely if not purchased
            }
            return testObj;
        });

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
            .map(p => {
                const t = p.testId.toObject();
                if (t.thumbnail) {
                    t.thumbnail = getDriveDirectLink(t.thumbnail);
                }
                if (t.studyMaterial?.googleDriveLink) {
                    t.studyMaterial.embedUrl = getDriveEmbedUrl(t.studyMaterial.googleDriveLink);
                    delete t.studyMaterial.googleDriveLink;
                }
                if (t.testType === 'pdf' && t.pdfLink) {
                    t.pdfEmbedUrl = getDriveEmbedUrl(t.pdfLink);
                    delete t.pdfLink;
                }
                return {
                    ...t,
                    hasPurchased: true,
                    purchasedAt: p.purchasedAt,
                    result: resultMap[p.testId._id.toString()] || null
                };
            });

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

        const purchase = await B2CPurchase.findOne({ userId, testId, status: 'completed' });
        if (!purchase) {
            return res.status(403).json({ success: false, message: 'You have not purchased this test.' });
        }

        const testRes = await B2CTest.findById(testId);
        if (!testRes || testRes.status !== 'active') {
            return res.status(404).json({ success: false, message: 'Test not found or not active.' });
        }

        const t = testRes.toObject();
        if (t.studyMaterial?.googleDriveLink) {
            t.studyMaterial.embedUrl = getDriveEmbedUrl(t.studyMaterial.googleDriveLink);
            delete t.studyMaterial.googleDriveLink;
        }
        if (t.testType === 'pdf' && t.pdfLink) {
            t.pdfEmbedUrl = getDriveEmbedUrl(t.pdfLink);
            delete t.pdfLink;
        }

        res.json({ success: true, data: t });
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

        const purchase = await B2CPurchase.findOne({ userId, testId, status: 'completed' });
        if (!purchase) return res.status(403).json({ success: false, message: 'Not purchased.' });

        const existingResult = await B2CResult.findOne({ userId, testId });
        if (existingResult) return res.json({ success: true, data: existingResult, message: 'Already submitted.' });

        const test = await B2CTest.findById(testId);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });

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
        const totalQuestions = test.questions.length;
        const score = correctAnswers;
        const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
        const isPassed = percentage >= 60;

        const result = await B2CResult.create({
            userId, testId, score, totalQuestions, correctAnswers,
            wrongAnswers: totalQuestions - correctAnswers,
            percentage, status: isPassed ? 'pass' : 'fail',
            submissionType, answers: graded,
            startedAt: startedAt ? new Date(startedAt) : null,
            submittedAt: new Date()
        });

        const user = await require('../models/User').findById(userId);
        if (user?.email) {
            try {
                await sendEmail({
                    to: user.email,
                    subject: `Your Test Result is Ready - HS LMS`,
                    htmlContent: getTestResultEmail(user.name, test.title, score, totalQuestions, percentage, correctAnswers, totalQuestions - correctAnswers, isPassed)
                });
            } catch (emailErr) {}
        }
        res.json({ success: true, data: result, message: 'Exam submitted successfully' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getB2CResult = async (req, res) => {
    try {
        const userId = req.user._id;
        const result = await B2CResult.findOne({ userId, testId: req.params.testId })
            .populate('testId', 'title category subject difficultyLevel duration');
        if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });
        res.json({ success: true, data: result });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.grantB2CTestAccess = async (userId, testId, paymentId, orderId, amount) => {
    try {
        const existing = await B2CPurchase.findOne({ userId, testId, status: 'completed' });
        if (existing) return;
        await B2CPurchase.create({ userId, testId, paymentId, orderId, amount, status: 'completed', purchasedAt: new Date() });
        return true;
    } catch (error) { throw error; }
};

exports.checkB2CTestPurchase = async (userId, testId) => {
    return await B2CPurchase.findOne({ userId, testId, status: 'completed' });
};

module.exports = exports;
