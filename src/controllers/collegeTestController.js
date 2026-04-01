const { Test } = require('../models/Exam');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Manual Test Creation
exports.createManualTest = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const { title, subject, description, duration, questions, assignedBatches, password, startTime, endTime, price } = req.body;

        const test = await Test.create({
            title,
            subject,
            description,
            duration: duration || 30,
            collegeId: isAdmin ? null : req.user.collegeId,
            assignedBatches: isAdmin ? [] : (assignedBatches || []),
            password: password || '',
            startTime: startTime || null,
            endTime: endTime || null,
            questions: questions || [],
            totalMarks: questions ? questions.length : 25,
            passingMarks: questions ? Math.ceil(questions.length * 0.4) : 10,
            price: price || 0,
            createdBy: isAdmin ? 'SUPER_ADMIN' : 'COLLEGE_ADMIN'
        });

        res.status(201).json({ success: true, data: test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Test Generation using AI (Gemini)
exports.generateAITest = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const { title, subject, description, difficulty, assignedBatches, password, startTime, endTime } = req.body;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const prompt = `Generate a 25 question multiple choice test on the following topic:
        Title: ${title}
        Subject: ${subject}
        Description: ${description}
        Difficulty: ${difficulty}

        QUALITY CONTROL REQUIREMENTS:
        - Generate high-quality, conceptual, and analytical questions (Real exam level MCQs).
        - Ensure absolutely NO duplicate or highly similar questions.
        - Ensure incorrect options are plausible distractors.

        Format the output EXACTLY as a raw JSON array of objects with these exact keys:
        - "text" (the question string)
        - "options" (array of exactly 4 strings representing the options)
        - "correctOption" (number 0-3 representing the index of the correct option in your array)
        - "explanation" (string explaining conceptually why the answer is correct)
        
        Output only the JSON array, no extra text, no markdown backticks.`;

        // Iteratively try models until one succeeds to prevent 404/Not Found errors
        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-flash-latest"
        ];
        let result = null;
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                result = await model.generateContent(prompt);
                
                break;
            } catch (err) {
                
                lastError = err;
                
                // If it's a rate limit error (429), stop looping and throw immediately to avoid masking the real issue
                if (err.status === 429 || err.message.includes('429') || err.message.includes('quota') || err.message.includes('retry')) {
                    throw new Error(`Google AI API Rate Limit Reached: ${err.message}. Please wait a few moments and try again.`);
                }
            }
        }

        if (!result) {
            
            throw new Error(`Google API threw an error across all model variants: ${lastError?.message || 'Unknown configuration issue.'}`);
        }

        let rawContent = result.response.text();
        

        // More robust JSON extraction - find the first [ and the last ]
        const startIndex = rawContent.indexOf('[');
        const endIndex = rawContent.lastIndexOf(']');

        if (startIndex === -1 || endIndex === -1) {
            
            throw new Error("The AI service returned an invalid response format (No JSON array found). This usually happens if the AI is refusing to generate content or has reached a quota limit.");
        }

        const jsonString = rawContent.substring(startIndex, endIndex + 1);

        let questions;
        try {
            questions = JSON.parse(jsonString);
        } catch (parseError) {
            
            require('fs').writeFileSync('ai_error_debug.txt', rawContent);
            throw new Error("Failed to parse AI generated questions. The AI output was malformed.");
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error("AI generated an empty or invalid question set.");
        }

        // Validate each question has required fields to prevent MongoDB validation errors
        const validatedQuestions = questions.map(q => ({
            text: q.text || "Untitled Question",
            options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["Option 1", "Option 2", "Option 3", "Option 4"],
            correctOption: typeof q.correctOption === 'number' ? q.correctOption : 0,
            explanation: q.explanation || "",
            marks: 1
        }));

        const test = await Test.create({
            title,
            subject,
            description: `${subject} - ${description} (${difficulty})`,
            duration: 30,
            isAI: true,
            collegeId: isAdmin ? null : req.user.collegeId,
            assignedBatches: isAdmin ? [] : (assignedBatches || []),
            password: password || '',
            startTime: startTime || null,
            endTime: endTime || null,
            questions: validatedQuestions,
            totalMarks: validatedQuestions.length,
            passingMarks: Math.ceil(validatedQuestions.length * 0.4),
            price: req.body.price || 0,
            createdBy: isAdmin ? 'SUPER_ADMIN' : 'COLLEGE_ADMIN'
        });

        res.status(201).json({ success: true, data: test });
    } catch (error) {
        console.error("AI Generation Critical Error:", {
            message: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: error.message.includes("API_KEY")
                ? "Gemini API Key is invalid or missing. Check server configuration."
                : error.message
        });
    }
};

// Get all tests for college
exports.getTests = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const filter = isAdmin ? {} : { collegeId: req.user.collegeId };
        const tests = await Test.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data: tests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single test
exports.getTest = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const filter = isAdmin ? { _id: req.params.testId } : { _id: req.params.testId, collegeId: req.user.collegeId };
        const test = await Test.findOne(filter);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
        res.json({ success: true, data: test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update test
exports.updateTest = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const filter = isAdmin ? { _id: req.params.testId } : { _id: req.params.testId, collegeId: req.user.collegeId };
        const { title, subject, description, duration, questions, assignedBatches, password, startTime, endTime, price } = req.body;
        const test = await Test.findOne(filter);

        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        if (title !== undefined) test.title = title;
        if (subject !== undefined) test.subject = subject;
        if (description !== undefined) test.description = description;
        if (duration !== undefined) test.duration = duration;
        if (assignedBatches !== undefined) test.assignedBatches = assignedBatches;
        if (password !== undefined) test.password = password;
        if (startTime !== undefined) test.startTime = startTime;
        if (endTime !== undefined) test.endTime = endTime;
        if (price !== undefined) test.price = price;

        if (questions) {
            test.questions = questions;
            test.totalMarks = questions.length;
            test.passingMarks = Math.ceil(questions.length * 0.4);
        }

        await test.save();
        res.json({ success: true, data: test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete test
exports.deleteTest = async (req, res) => {
    try {
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const filter = isAdmin ? { _id: req.params.testId } : { _id: req.params.testId, collegeId: req.user.collegeId };
        const test = await Test.findOneAndDelete(filter);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
        res.json({ success: true, message: 'Test deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get test results
exports.getTestResults = async (req, res) => {
    try {
        const { testId } = req.params;
        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const filter = isAdmin ? { _id: testId } : { _id: testId, collegeId: req.user.collegeId };
        
        const test = await Test.findOne(filter);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        const { Result } = require('../models/Exam');
        const results = await Result.find({ testId })
            .populate({
                path: 'userId',
                select: 'name email studentId divisionId',
                populate: { path: 'divisionId', select: 'name' }
            })
            .populate('batchId', 'name')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: results, test });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Publish test results
exports.publishTestResults = async (req, res) => {
    try {
        const { testId } = req.params;
        const test = await Test.findOne({ _id: testId, collegeId: req.user.collegeId });

        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        test.isPublished = true;
        await test.save();

        // Fetch all results for this test
        const { Result } = require('../models/Exam');
        const results = await Result.find({ testId }).populate('userId', 'name email');

        const { sendEmail } = require('../utils/brevo');

        // Send email to each student
        for (const result of results) {
            if (result.userId && result.userId.email) {
                try {
                    await sendEmail({
                        to: result.userId.email,
                        subject: 'Test Results Published',
                        htmlContent: `
                            <div style="font-family: sans-serif; padding: 20px;">
                                <h2>Test Results Available</h2>
                                <p>Hello ${result.userId.name},</p>
                                <p>The results for the test <strong>${test.title}</strong> have been published.</p>
                                <p><strong>Your Score:</strong> ${result.score} / ${result.totalQuestions} (${result.score}%)</p>
                                <p><strong>Status:</strong> ${result.status.toUpperCase()}</p>
                                <p>Log in to your dashboard to view detailed results.</p>
                            </div>
                        `
                    });
                } catch (emailErr) {
                    
                }
            }
        }

        res.json({ success: true, message: 'Results published and emails sent.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update test status (Active/Disabled)
exports.updateTestStatus = async (req, res) => {
    try {
        const { testId } = req.params;
        const { status } = req.body;

        if (!['active', 'disabled'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const isAdmin = ['super_admin', 'administrator'].includes(req.user.role);
        const filter = isAdmin ? { _id: testId } : { _id: testId, collegeId: req.user.collegeId };

        const test = await Test.findOne(filter);
        if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

        test.status = status;
        await test.save();

        res.json({
            success: true,
            message: `Test ${status === 'active' ? 'activated' : 'disabled'} successfully`,
            data: { status: test.status }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
