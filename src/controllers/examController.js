const { Test, Result } = require('../models/Exam');
const { ProgressTracking } = require('../models/Tracking');

exports.createTest = async (req, res) => {
    try {
        const test = await Test.create(req.body);
        res.status(201).json({ success: true, data: test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTest = async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        // Security: Ensure student belongs to the same college as the test
        if (req.user.role === 'student' && test.collegeId.toString() !== req.user.collegeId.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied: Test belongs to another institution' });
        }

        res.json({ success: true, data: test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.submitTest = async (req, res) => {
    try {
        const { testId, answers, monitoringLogs, startTime } = req.body;
        const test = await Test.findById(testId);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        let correctCount = 0;
        const detailedAnswers = answers.map(ans => {
            const question = test.questions.id(ans.questionId);
            // Handle skipped questions (selectedOption = -1 or null)
            const isCorrect = (ans.selectedOption !== -1 && ans.selectedOption !== null) && 
                              (question.correctOption === ans.selectedOption);
            if (isCorrect) correctCount++;
            return {
                questionId: ans.questionId,
                selectedOption: ans.selectedOption,
                isCorrect
            };
        });

        const totalQuestions = test.questions.length;
        const incorrectAnswers = totalQuestions - correctCount;
        const score = (correctCount / totalQuestions) * 100;
        const status = score >= (test.passingMarks / test.totalMarks) * 100 ? 'pass' : 'fail';

        const result = await Result.create({
            userId: req.user.id,
            batchId: req.user.batchId || null,
            testId,
            score,
            totalQuestions,
            correctAnswers: correctCount,
            incorrectAnswers,
            status,
            answers: detailedAnswers,
            monitoringLogs: monitoringLogs || [],
            startTime: startTime || new Date(Date.now() - test.duration * 60000),
            completedAt: new Date()
        });

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
