const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Payment, TestPurchase } = require('../models/Tracking');
const UserPurchase = require('../models/UserPurchase');
const { Course } = require('../models/Course');
const { Test } = require('../models/Exam');
const { B2CTest, B2CPurchase } = require('../models/B2CTest');
const { sendEmail } = require('../utils/brevo');
const { getCoursePurchaseEmail, getTestPurchaseEmail } = require('../utils/emailTemplates');

// Razorpay configuration check
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const isConfigured = RAZORPAY_KEY_ID && 
                     RAZORPAY_KEY_ID !== 'your_razorpay_key_id' && 
                     RAZORPAY_KEY_SECRET &&
                     RAZORPAY_KEY_SECRET !== 'your_razorpay_key_secret';

let razorpay;
if (isConfigured) {
    razorpay = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
    });
}

/**
 * B2C Payment Guard Middleware Logic
 */
const isB2CUser = (user) => user && user.role === 'user';

const { validationResult } = require('express-validator');

// ─── CREATE ORDER (SECURE) ───────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
    // 1. Validation Results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Invalid request parameters', errors: errors.array() });
    }

    // 2. Configuration Check
    if (!razorpay) {
        
        return res.status(503).json({ 
            success: false, 
            message: 'Payment service unavailable. Please contact support.' 
        });
    }

    try {
        // 2. Strict Role Verification
        if (!isB2CUser(req.user)) {
            return res.status(403).json({
                success: false,
                message: 'Payment is only available for individual users. Admin and college users have free access.'
            });
        }

        // 3. SECURE INPUT HANDLING
        const { courseId, testId, b2cTestId, itemType = 'course' } = req.body;

        let item;
        if (itemType === 'course') {
            item = await Course.findById(courseId);
        } else if (itemType === 'test') {
            item = await Test.findById(testId);
        } else if (itemType === 'b2c_test') {
            item = await B2CTest.findById(b2cTestId);
        }

        if (!item) {
            
            return res.status(404).json({ success: false, message: 'Invalid Selection' });
        }

        // 4. ANTI-TAMPERING & STATUS CHECKS
        const isPublished = itemType === 'course' ? item.isPublished : item.status === 'active';
        if (!isPublished) {
            
            return res.status(403).json({ success: false, message: `This item is currently unavailable for purchase.` });
        }
        
        const price = item.price;
        if (price <= 0) {
            return res.status(400).json({ success: false, message: `This item is free. No payment required.` });
        }

        // 5. DUPLICATE PURCHASE PREVENTION
        if (itemType === 'course') {
            const existing = await UserPurchase.findOne({ userId: req.user._id, courseId: item._id, status: 'completed' });
            if (existing) return res.status(400).json({ success: false, message: 'You have already purchased this course.' });
        } else if (itemType === 'b2c_test') {
            const existing = await B2CPurchase.findOne({ userId: req.user._id, testId: item._id, status: 'completed' });
            if (existing) return res.status(400).json({ success: false, message: 'You have already purchased access to this test.' });
        } else {
            const existing = await TestPurchase.findOne({ userId: req.user._id, testId: item._id, status: 'completed' });
            if (existing) return res.status(400).json({ success: false, message: 'You have already purchased access to this test.' });
        }

        // 6. SECURE AMOUNT CALCULATION
        const finalAmount = Math.round(price * 100); // amount in paise for Razorpay

        // 7. ---- LIVE RAZORPAY LOGIC (STRICT) ----
        
        const options = {
            amount: finalAmount, 
            currency: 'INR',
            receipt: `receipt_${itemType}_${Date.now()}_${req.user._id.toString().slice(-4)}`
        };

        const order = await razorpay.orders.create(options);

        // Save pending payment record
        await Payment.create({
            userId: req.user._id,
            courseId: itemType === 'course' ? item._id : null,
            testId: (itemType === 'test' || itemType === 'b2c_test') ? item._id : null,
            itemType,
            razorpayOrderId: order.id,
            amount: price,
            status: 'pending'
        });

        res.json({ success: true, order, itemId: item._id });
    } catch (error) {
        
        res.status(500).json({ 
            success: false, 
            message: "Payment initialization failed",
            error: error.message 
        });
    }
};

// ─── VERIFY PAYMENT ───────────────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
    try {
        if (!isB2CUser(req.user)) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            courseId,
            b2cTestId
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
             return res.status(400).json({ success: false, message: 'Missing payment details.' });
        }

        // ---- LIVE VERIFICATION ----
        
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            
            await Payment.findOneAndUpdate({ razorpayOrderId: razorpay_order_id }, { status: 'failed' });
            return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
        }

        const paymentRecord = await Payment.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            {
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
                status: 'completed'
            },
            { new: true }
        );

        if (!paymentRecord) {
             
             return res.status(404).json({ success: false, message: 'Payment record not found.' });
        }

        if (paymentRecord.itemType === 'course') {
            await grantCourseAccess(req.user, paymentRecord.courseId, razorpay_payment_id, paymentRecord.amount);
            res.json({ success: true, message: 'Payment verified. Course access granted!' });
        } else if (paymentRecord.itemType === 'b2c_test') {
            await grantB2CTestAccess(req.user, paymentRecord.testId, razorpay_payment_id, razorpay_order_id, paymentRecord.amount);
            res.json({ success: true, message: 'Test purchased successfully! You can now start the test.' });
        } else {
            await grantTestAccess(req.user, paymentRecord.testId, razorpay_payment_id, paymentRecord.amount);
            res.json({ success: true, message: 'Payment verified. Test access granted!' });
        }
    } catch (error) {
        
        res.status(500).json({ success: false, message: error.message });
    }
};

async function grantCourseAccess(user, courseId, paymentId, amount) {
    const existing = await UserPurchase.findOne({ userId: user._id, courseId, status: 'completed' });
    if (existing) return;

    await UserPurchase.create({
        userId: user._id,
        courseId,
        paymentId,
        amount,
        status: 'completed'
    });

    // 4. Send Emails
    const course = await Course.findById(courseId);
    if (!course) return;

    const date = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });

    try {
        await sendEmail({
            to: user.email,
            subject: `Course Purchase Confirmed - HS LMS`,
            htmlContent: getCoursePurchaseEmail(user.name, course.title, amount, date)
        });
    } catch (e) {  }
}

async function grantTestAccess(user, testId, paymentId, amount) {
    const existing = await TestPurchase.findOne({ userId: user._id, testId, status: 'completed' });
    if (existing) return;

    await TestPurchase.create({
        userId: user._id,
        testId,
        paymentId,
        amount,
        status: 'completed'
    });

    const test = await Test.findById(testId);
    if (!test) return;

    const date = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
    try {
        await sendEmail({
            to: user.email,
            subject: `Test Purchase Confirmed - HS LMS`,
            htmlContent: getTestPurchaseEmail(user.name, test.title, test.subject || '', amount, date, test.duration)
        });
    } catch (e) {  }
}

async function grantB2CTestAccess(user, testId, paymentId, orderId, amount) {
    const existing = await B2CPurchase.findOne({ userId: user._id, testId, status: 'completed' });
    if (existing) return;

    await B2CPurchase.create({
        userId: user._id,
        testId,
        paymentId,
        orderId,
        amount,
        status: 'completed',
        purchasedAt: new Date()
    });

    const test = await B2CTest.findById(testId);
    if (!test) return;

    const date = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
    try {
        await sendEmail({
            to: user.email,
            subject: `Test Purchase Confirmed - HS LMS`,
            htmlContent: getTestPurchaseEmail(user.name, test.title, test.category || '', amount, date, test.duration)
        });
    } catch (e) {  }
}

// Legacy template kept for backward compat - not used for new emails
function getEmailTemplate(title, userName, itemName, amount, date, showCTA = false, link = '/dashboard') {
    return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; padding: 40px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 40px 60px -15px rgba(0,0,0,0.1);">
            <div style="background: #2563eb; padding: 40px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 28px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 2px;">HS LMS</h1>
                <p style="color: #bfdbfe; font-size: 14px; font-weight: 600; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px;">Quality Education for Everyone</p>
            </div>
            
            <div style="padding: 40px;">
                <h2 style="font-size: 24px; font-weight: 800; color: #1e293b; margin-bottom: 20px;">${title}</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 30px;">
                    Hi <strong>${userName}</strong>,<br>
                    Your transaction for <strong>${itemName}</strong> has been successfully processed.
                </p>
                
                <div style="background: #f1f5f9; border-radius: 16px; padding: 25px; margin-bottom: 30px;">
                    <table style="width: 100%; font-size: 14px; color: #475569;">
                        <tr>
                            <td style="padding: 5px 0; font-weight: 600;">Item</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #1e293b;">${itemName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; font-weight: 600;">Amount Paid</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #1e293b;">₹${amount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; font-weight: 600;">Date</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #1e293b;">${date}</td>
                        </tr>
                    </table>
                </div>

                ${showCTA ? `
                <div style="text-align: center; margin-top: 40px;">
                    <a href="${process.env.CLIENT_URL}${link}" 
                       style="display: inline-block; background: #2563eb; color: #ffffff; padding: 18px 36px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 10px 15px -3px rgba(37,99,235,0.4);">
                       Go to Dashboard
                    </a>
                </div>
                ` : ''}

                <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="font-size: 12px; color: #94a3b8;">
                        This is an automated message. Please do not reply to this email.<br>
                        &copy; ${new Date().getFullYear()} HS LMS. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    </div>
    `;
}
