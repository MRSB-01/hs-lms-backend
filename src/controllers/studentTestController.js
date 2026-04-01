const { Test, Result } = require('../models/Exam');
const { TestPurchase } = require('../models/Tracking');
const User = require('../models/User');

// Get all tests assigned securely to student's batch
exports.getStudentTests = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const isB2C = user.role === 'user';
        
        let tests;
        if (isB2C) {
            // Fetch all active tests created by Super Admin (Global tests for B2C)
            tests = await Test.find({
                status: 'active',
                createdBy: 'SUPER_ADMIN'
            })
            .select('-questions.correctOption -questions.explanation -password')
            .sort({ createdAt: -1 });
        } else {
            if (!user.batchId) {
                return res.status(400).json({ success: false, message: 'You are not assigned to any batch.' });
            }
            tests = await Test.find({
                status: 'active',
                assignedBatches: user.batchId,
                endTime: { $gte: new Date() }
            })
            .select('-questions.correctOption -questions.explanation -password')
            .sort({ startTime: 1 });
        }

        const results = await Result.find({ userId: user._id }).select('testId score isPublished submissionType');
        const purchases = isB2C ? await TestPurchase.find({ userId: user._id, status: 'completed' }) : [];
        
        const now = new Date();

        const formattedTests = tests.map(test => {
            const result = results.find(r => r.testId.toString() === test._id.toString());
            const hasPurchased = !isB2C || purchases.some(p => p.testId.toString() === test._id.toString());
            
            let examState = 'available';
            if (!isB2C) {
                if (test.startTime && now < new Date(test.startTime)) examState = 'upcoming';
                else if (test.endTime && now > new Date(test.endTime)) examState = 'ended';
            }

            return {
                ...test._doc,
                hasAttempted: !!result,
                hasPurchased,
                examState,
                isPublished: test.isPublished,
                score: (test.isPublished && result) ? result.score : null,
                submissionType: result ? result.submissionType : null
            };
        });

        res.json({ success: true, data: formattedTests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Start a test (verify password and return randomized questions)
exports.startTest = async (req, res) => {
    try {
        const { testId, password } = req.body;
        const student = await User.findById(req.user.id);

        if (!student.batchId) {
            return res.status(403).json({ success: false, message: 'Not assigned to a batch' });
        }

        const test = await Test.findById(testId);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        const isB2C = student.role === 'user';

        if (isB2C) {
            if (test.price > 0) {
                const purchase = await TestPurchase.findOne({ userId: student._id, testId: test._id, status: 'completed' });
                if (!purchase) return res.status(403).json({ success: false, message: 'Please purchase this test to continue.' });
            }
        } else {
            if (!student.batchId) return res.status(403).json({ success: false, message: 'Not assigned to a batch' });
            if (!test.assignedBatches.some(bId => bId.toString() === student.batchId.toString())) {
                return res.status(403).json({ success: false, message: 'Test not assigned to your batch' });
            }
        }

        // Verify password
        if (test.password && test.password !== password) {
            return res.status(401).json({ success: false, message: 'Incorrect test password' });
        }

        // Verify timing schedule
        const now = new Date();
        if (!isB2C) {
            if (test.startTime && now < new Date(test.startTime)) {
                return res.status(403).json({ success: false, message: 'Test has not started yet.' });
            }
            if (test.endTime && now > new Date(test.endTime)) {
                return res.status(403).json({ success: false, message: 'Test window has ended.' });
            }
        }

        // Check if already attempted
        const existingResult = await Result.findOne({ userId: student._id, testId: test._id });
        if (existingResult) {
            return res.status(403).json({ success: false, message: 'You have already attempted this test.' });
        }

        // Randomize questions and options, strip correct answers
        const randomizedQuestions = test.questions.map(q => {
            // Shuffle options but keep a mapping so we know what they selected relative to original
            const options = [...q.options];
            const originalCorrect = q.correctOption;
            
            // Randomize options
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }

            return {
                _id: q._id,
                text: q.text,
                options: options,
                marks: q.marks,
                // Don't leak correctOption or explanation!
            };
        });

        // Randomize question order
        for (let i = randomizedQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randomizedQuestions[i], randomizedQuestions[j]] = [randomizedQuestions[j], randomizedQuestions[i]];
        }

        res.json({ 
            success: true, 
            data: {
                _id: test._id,
                title: test.title,
                duration: test.duration,
                questions: randomizedQuestions
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Submit Test
exports.submitStudentTest = async (req, res) => {
    try {
        const { testId, answers, logs } = req.body;
        const student = await User.findById(req.user.id);

        const test = await Test.findById(testId);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        // Calculate score securely on backend
        let score = 0;
        let correctCount = 0;
        let incorrectCount = 0;
        
        const processedAnswers = [];

        // For each answer the student provided...
        for (const ans of answers || []) {
            // Find the original question
            const originalQ = test.questions.find(q => q._id.toString() === ans.questionId);
            if (!originalQ) continue;

            // Student selected an option string mathematically mapping to our randomized array
            // The frontend sends the absolute string they selected. We match it to our original array index.
            const selectedString = ans.selectedString;
            let isCorrect = false;

            if (selectedString === originalQ.options[originalQ.correctOption]) {
                isCorrect = true;
                score += (originalQ.marks || 1);
                correctCount++;
            } else {
                incorrectCount++;
            }

            processedAnswers.push({
                questionId: originalQ._id,
                selectedOptionString: selectedString, // Save what they picked
                isCorrect
            });
        }

        const isPass = score >= test.passingMarks;

        const result = await Result.create({
            userId: student._id,
            batchId: student.batchId || null,
            testId: test._id,
            score,
            totalQuestions: test.questions.length,
            correctAnswers: correctCount,
            incorrectAnswers: incorrectCount,
            status: isPass ? 'pass' : 'fail',
            submissionType: req.body.submissionType || 'COMPLETED',
            answers: processedAnswers,
            monitoringLogs: logs || [],
            completedAt: new Date()
        });

        res.json({ 
            success: true, 
            message: 'Test submitted successfully.',
            data: {
                id: result._id,
                // Do not return score. They wait until published!
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
