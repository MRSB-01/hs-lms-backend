const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config({ path: './.env' });

const Batch = require('./src/models/Batch');
const User = require('./src/models/User');
const { Course } = require('./src/models/Course');

async function testE2E() {
    console.log("Starting End-to-End Verification...");
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB.");

        // 1. Setup Database
        const collegeAdmin = await User.findOne({ role: 'college_admin' });
        if (!collegeAdmin) throw new Error("No college admin found.");

        const course = await Course.findOne() || await Course.create({
            title: "Test Course",
            description: "Test Course",
            price: 0,
            isPublished: true
        });

        // Generate token for admin to call APIs
        const jwt = require('jsonwebtoken');
        const adminToken = jwt.sign({ id: collegeAdmin._id, role: 'college_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const apiBase = `http://localhost:${process.env.PORT || 5000}/api`;

        // 2. College Admin creates a batch
        const batchPayload = {
            name: "Test Batch " + Date.now(),
            programName: "MCA",
            year: "2026",
            assignedCourses: [] // Even if called assignedCourses in req body, it saves as courses
        };
        console.log("Creating Batch...");
        let createBatchRes = await axios.post(`${apiBase}/college/batches`, batchPayload, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const batchId = createBatchRes.data.data._id;
        let batchCode = createBatchRes.data.data.batchCode;
        console.log(`Batch Created. ID: ${batchId}, Code: ${batchCode}`);

        // 3. College Admin assigns course to that Batch
        console.log(`Assigning Course ${course._id} to Batch...`);
        await axios.post(`${apiBase}/college/assign-course`, {
            courseId: course._id.toString(),
            batchId: batchId.toString()
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        // VERIFY: Confirm in MongoDB that the Batch document has the course IDs saved
        const updatedBatch = await Batch.findById(batchId);
        if (!updatedBatch.courses || updatedBatch.courses.length === 0) {
            throw new Error(`Verification Failed: courses array is empty in DB. courses: ${updatedBatch.courses}, assignedCourses: ${updatedBatch.assignedCourses}`);
        }
        if (updatedBatch.courses[0].toString() !== course._id.toString()) {
            throw new Error("Verification Failed: Mismatched course ID in DB.");
        }
        console.log("✓ Correct: Batch document has course IDs saved in the 'courses' array.");

        // 4. Student registers using the Batch Code
        console.log(`Student registering with Batch Code: ${batchCode}...`);
        const studentEmail = `student_${Date.now()}@test.com`;
        const registerRes = await axios.post(`${apiBase}/student/auth/register`, {
            name: "Test Student",
            email: studentEmail,
            password: "Password123",
            batchCode: batchCode
        });
        const studentRegData = registerRes.data.data;
        const studentId = studentRegData.studentId;
        console.log(`Student registered. Student ID: ${studentId}`);

        // Automatically verify student to allow login
        const studentDoc = await User.findOne({ email: studentEmail });
        studentDoc.isVerified = true;
        await studentDoc.save();

        // VERIFY: Confirm in MongoDB that the Student document has the correct batchId
        if (!studentDoc.batchId || studentDoc.batchId.toString() !== batchId.toString()) {
            throw new Error("Verification Failed: Student document does not have correct batchId.");
        }
        console.log("✓ Correct: Student document has the correct batchId saved.");

        // 5. Student logs in
        console.log(`Student logging in...`);
        const loginRes = await axios.post(`${apiBase}/student/auth/login`, {
            studentId: studentId,
            password: "Password123"
        });
        const studentToken = loginRes.data.token;

        // 6. API returns the correct courses from the batch
        console.log(`Fetching student courses...`);
        const coursesRes = await axios.get(`${apiBase}/student/courses`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        const studentCourses = coursesRes.data.data;

        if (!studentCourses || studentCourses.length === 0) {
            throw new Error("Verification Failed: Student courses API returned empty.");
        }
        if (studentCourses[0]._id.toString() !== course._id.toString()) {
            throw new Error("Verification Failed: Student courses API returned wrong course data.");
        }
        console.log("✓ Correct: Student Courses API returned the correct courses (populated).");

        console.log("\nALL TESTS PASSED SUCCESSFULLY!");
    } catch (err) {
        console.error("Test Error:", err.message);
        if (err.response) {
            console.error("Axios Response Data:", err.response.data);
        }
    } finally {
        await mongoose.disconnect();
    }
}

testE2E();
