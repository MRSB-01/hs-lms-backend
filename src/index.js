require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const envConfig = require('./config/envConfig');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: envConfig.CLIENT_URL,
    credentials: true
}));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
}));
app.use(morgan('dev'));

// Database Connection & Server Start
mongoose.connect(envConfig.MONGODB_URI)
    .then(() => {
        console.log("-- MongoDB Connected Successfully");

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, () => {
            console.log(`-- Server is running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("-- MongoDB Connection Failed:", err.message);
        process.exit(1); // exit if DB fails
    });

// Rate Limiter for AUTH routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { success: false, message: "Too many login attempts from this IP, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/colleges', require('./routes/collegeRoutes'));
app.use('/api/admin', require('./routes/systemAdminRoutes'));
app.use('/api/system', require('./routes/superAdminRoutes'));
app.use('/api/college', require('./routes/collegeAdminRoutes'));
app.use('/api/student/auth', authLimiter, require('./routes/studentAuthRoutes'));
app.use('/api/student', require('./routes/studentRoutes')); // Student
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/exams', require('./routes/examRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/b2c', require('./routes/b2cTestRoutes')); // B2C Test Module

app.get('/', (req, res) => {
    res.send('LMS API is running...');
});

// Error Handling Middleware
app.use((err, req, res, next) => {

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});
