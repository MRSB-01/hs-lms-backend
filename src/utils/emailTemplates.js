/**
 * Professional Email Templates for HS LMS
 * All templates use inline CSS for maximum email client compatibility
 */

const BASE_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const BRAND = {
    primary: '#4338ca', // Indigo-700
    primaryLight: '#6366f1',
    primaryDark: '#3730a3',
    accent: '#818cf8',
    text: '#1e293b',
    muted: '#64748b',
    border: '#e2e8f0',
    bg: '#f8fafc',
    white: '#ffffff'
};

const headerStyle = `background: linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 60%, ${BRAND.primaryLight} 100%); padding: 40px 48px; text-align: center;`;
const containerStyle = `max-width: 620px; margin: 0 auto; background: ${BRAND.white}; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(67,56,202,0.12);`;
const bodyStyle = `padding: 48px;`;
const footerStyle = `background: #f1f5f9; padding: 32px 48px; text-align: center; border-top: 1px solid ${BRAND.border};`;

const btnStyle = (color = BRAND.primary) => `display: inline-block; background: ${color}; color: ${BRAND.white}; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; font-family: 'Segoe UI', sans-serif; letter-spacing: 0.5px; box-shadow: 0 8px 20px rgba(67,56,202,0.3);`;

const headerHTML = `
    <div style="${headerStyle}">
        <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <div style="width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🎓</div>
            <h1 style="color: ${BRAND.white}; font-size: 26px; font-weight: 900; margin: 0; letter-spacing: -0.5px; font-family: 'Segoe UI', sans-serif;">HS LMS</h1>
        </div>
        <p style="color: rgba(255,255,255,0.7); font-size: 11px; margin: 0; letter-spacing: 3px; text-transform: uppercase; font-family: 'Segoe UI', sans-serif; font-weight: 600;">Hruta Solutions • Quality Education</p>
    </div>`;

const footerHTML = `
    <div style="${footerStyle}">
        <p style="color: ${BRAND.muted}; font-size: 13px; margin: 0 0 8px; font-family: 'Segoe UI', sans-serif; font-weight: 600;">HS LMS by Hruta Solutions</p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0 0 16px; font-family: 'Segoe UI', sans-serif;">Pune, Maharashtra, India</p>
        <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 16px;">
            <a href="https://instagram.com/hrutasolutions" style="color: ${BRAND.primaryLight}; text-decoration: none; font-size: 12px; font-family: 'Segoe UI', sans-serif; font-weight: 700;">Instagram</a>
            <span style="color: ${BRAND.border};">|</span>
            <a href="https://linkedin.com/company/hrutasolutions" style="color: ${BRAND.primaryLight}; text-decoration: none; font-size: 12px; font-family: 'Segoe UI', sans-serif; font-weight: 700;">LinkedIn</a>
        </div>
        <p style="color: #cbd5e1; font-size: 11px; margin: 0; font-family: 'Segoe UI', sans-serif;">© ${new Date().getFullYear()} HS LMS. All rights reserved. This is an automated message.</p>
    </div>`;

/**
 * EMAIL 1: Welcome Email on Registration
 */
exports.getWelcomeEmail = (name) => {
    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to HS LMS</title></head>
    <body style="margin: 0; padding: 24px 16px; background: ${BRAND.bg}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="${containerStyle}">
            ${headerHTML}
            <div style="${bodyStyle}">
                <div style="text-align: center; margin-bottom: 40px;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ede9fe, #ddd6fe); border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 36px;">🎉</div>
                    <h2 style="color: ${BRAND.text}; font-size: 28px; font-weight: 900; margin: 0 0 8px; letter-spacing: -0.5px;">Welcome to HS LMS!</h2>
                    <p style="color: ${BRAND.muted}; font-size: 14px; margin: 0;">Your learning journey begins now</p>
                </div>

                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
                    Hi <strong style="color: ${BRAND.primary};">${name}</strong>,
                </p>
                <p style="color: ${BRAND.muted}; font-size: 15px; line-height: 1.8; margin-bottom: 32px;">
                    Welcome to <strong>HS LMS</strong> — your all-in-one platform for skill development, professional certifications, and career growth. We're thrilled to have you on board!
                </p>

                <div style="background: linear-gradient(135deg, #ede9fe, #f0f4ff); border-radius: 16px; padding: 28px; margin-bottom: 32px;">
                    <h3 style="color: ${BRAND.primaryDark}; font-size: 14px; font-weight: 800; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px;">What you can do on HS LMS:</h3>
                    <div style="display: grid; gap: 12px;">
                        ${[
                            ['📚', 'Explore curated courses across multiple domains'],
                            ['🧪', 'Take skill assessment tests and earn certificates'],
                            ['📊', 'Track your learning progress in real-time'],
                            ['🏆', 'Showcase your achievements to employers']
                        ].map(([icon, text]) => `
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 18px;">${icon}</span>
                                <span style="color: ${BRAND.text}; font-size: 14px; font-weight: 500;">${text}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div style="text-align: center; margin-bottom: 40px;">
                    <a href="${BASE_URL}/dashboard" style="${btnStyle()}">Explore the Platform →</a>
                </div>

                <p style="color: ${BRAND.muted}; font-size: 13px; line-height: 1.6; text-align: center;">
                    Have questions? Reply to this email or contact our support team. We're here to help!
                </p>
            </div>
            ${footerHTML}
        </div>
    </body></html>`;
};

/**
 * EMAIL 2: Course Purchase Confirmation
 */
exports.getCoursePurchaseEmail = (name, courseName, amount, purchaseDate) => {
    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Course Purchase Confirmed</title></head>
    <body style="margin: 0; padding: 24px 16px; background: ${BRAND.bg}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="${containerStyle}">
            ${headerHTML}
            <div style="${bodyStyle}">
                <div style="text-align: center; margin-bottom: 40px;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #dcfce7, #d1fae5); border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 36px;">✅</div>
                    <h2 style="color: ${BRAND.text}; font-size: 26px; font-weight: 900; margin: 0 0 8px;">Course Purchase Confirmed!</h2>
                    <p style="color: ${BRAND.muted}; font-size: 14px; margin: 0;">You're all set to start learning</p>
                </div>

                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.7; margin-bottom: 28px;">
                    Hi <strong style="color: ${BRAND.primary};">${name}</strong>,<br>
                    Thank you for your purchase! Your course access has been activated immediately.
                </p>

                <div style="background: #f8fafc; border: 1px solid ${BRAND.border}; border-radius: 16px; padding: 28px; margin-bottom: 32px;">
                    <h3 style="color: ${BRAND.muted}; font-size: 11px; font-weight: 800; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 2px;">Purchase Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px 0; color: ${BRAND.muted}; font-size: 13px; border-bottom: 1px solid ${BRAND.border};">Course Name</td>
                            <td style="padding: 10px 0; color: ${BRAND.text}; font-size: 14px; font-weight: 700; text-align: right; border-bottom: 1px solid ${BRAND.border};">${courseName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: ${BRAND.muted}; font-size: 13px; border-bottom: 1px solid ${BRAND.border};">Amount Paid</td>
                            <td style="padding: 10px 0; color: #059669; font-size: 16px; font-weight: 900; text-align: right; border-bottom: 1px solid ${BRAND.border};">₹${amount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: ${BRAND.muted}; font-size: 13px;">Purchase Date</td>
                            <td style="padding: 10px 0; color: ${BRAND.text}; font-size: 13px; font-weight: 600; text-align: right;">${purchaseDate}</td>
                        </tr>
                    </table>
                </div>

                <div style="text-align: center; margin-bottom: 40px;">
                    <a href="${BASE_URL}/dashboard/my-courses" style="${btnStyle('#059669')}">🚀 Start Learning Now</a>
                </div>

                <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 16px 20px;">
                    <p style="color: #92400e; font-size: 13px; margin: 0; font-weight: 500;">
                        💡 <strong>Pro Tip:</strong> Set aside dedicated study time each day to get the most from your course!
                    </p>
                </div>
            </div>
            ${footerHTML}
        </div>
    </body></html>`;
};

/**
 * EMAIL 3: B2C Test Purchase Confirmation
 */
exports.getTestPurchaseEmail = (name, testTitle, category, amount, purchaseDate, duration = 30) => {
    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Test Purchase Confirmed</title></head>
    <body style="margin: 0; padding: 24px 16px; background: ${BRAND.bg}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="${containerStyle}">
            ${headerHTML}
            <div style="${bodyStyle}">
                <div style="text-align: center; margin-bottom: 40px;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ede9fe, #ddd6fe); border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 36px;">🧪</div>
                    <h2 style="color: ${BRAND.text}; font-size: 26px; font-weight: 900; margin: 0 0 8px;">Test Purchase Successful!</h2>
                    <p style="color: ${BRAND.muted}; font-size: 14px; margin: 0;">Your test access has been unlocked</p>
                </div>

                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.7; margin-bottom: 28px;">
                    Hi <strong style="color: ${BRAND.primary};">${name}</strong>,<br>
                    Congratulations! You have successfully purchased access to the test below.
                </p>

                <div style="background: #f8fafc; border: 1px solid ${BRAND.border}; border-radius: 16px; padding: 28px; margin-bottom: 28px;">
                    <h3 style="color: ${BRAND.muted}; font-size: 11px; font-weight: 800; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 2px;">Purchase Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px 0; color: ${BRAND.muted}; font-size: 13px; border-bottom: 1px solid ${BRAND.border};">Test Title</td>
                            <td style="padding: 10px 0; color: ${BRAND.text}; font-size: 14px; font-weight: 700; text-align: right; border-bottom: 1px solid ${BRAND.border};">${testTitle}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: ${BRAND.muted}; font-size: 13px; border-bottom: 1px solid ${BRAND.border};">Category</td>
                            <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid ${BRAND.border};"><span style="background: #ede9fe; color: ${BRAND.primary}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">${category}</span></td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: ${BRAND.muted}; font-size: 13px; border-bottom: 1px solid ${BRAND.border};">Amount Paid</td>
                            <td style="padding: 10px 0; color: ${BRAND.primary}; font-size: 16px; font-weight: 900; text-align: right; border-bottom: 1px solid ${BRAND.border};">₹${amount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: ${BRAND.muted}; font-size: 13px;">Purchase Date</td>
                            <td style="padding: 10px 0; color: ${BRAND.text}; font-size: 13px; font-weight: 600; text-align: right;">${purchaseDate}</td>
                        </tr>
                    </table>
                </div>

                <div style="background: linear-gradient(135deg, #ede9fe, #f0f4ff); border-radius: 16px; padding: 24px; margin-bottom: 32px;">
                    <h3 style="color: ${BRAND.primaryDark}; font-size: 13px; font-weight: 800; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px;">📋 Exam Instructions</h3>
                    ${[
                        [`⏱️ Duration`, `${duration} minutes — timer starts when you begin`],
                        [`❓ Questions`, `25 MCQ questions, 1 mark each`],
                        [`🔒 Security`, `Full-screen mode enforced, no tab switching allowed`],
                        [`⚠️ Auto-Submit`, `Leaving full-screen or switching tabs triggers auto-submission`],
                        [`📷 Monitoring`, `Camera & microphone required during the exam`],
                    ].map(([label, value]) => `
                        <div style="display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-start;">
                            <span style="color: ${BRAND.text}; font-size: 13px; font-weight: 700; min-width: 120px;">${label}</span>
                            <span style="color: ${BRAND.muted}; font-size: 13px;">${value}</span>
                        </div>`).join('')}
                </div>

                <div style="text-align: center; margin-bottom: 40px;">
                    <a href="${BASE_URL}/dashboard/my-tests" style="${btnStyle()}">🧪 Go to My Tests</a>
                </div>
            </div>
            ${footerHTML}
        </div>
    </body></html>`;
};

/**
 * EMAIL 4: B2C Test Result
 */
exports.getTestResultEmail = (name, testTitle, score, totalQuestions, percentage, correctAnswers, wrongAnswers, isPassed) => {
    const statusColor = isPassed ? '#059669' : '#dc2626';
    const statusBg = isPassed ? '#dcfce7' : '#fee2e2';
    const statusText = isPassed ? 'PASSED' : 'FAILED';
    const statusIcon = isPassed ? '🏆' : '📖';
    const message = isPassed 
        ? `Congratulations! You've passed the test with a great score. Keep up the excellent work and continue your learning journey!`
        : `Don't be discouraged! Learning is a process. Review the topics, practice more, and you'll ace it next time!`;

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your Test Result</title></head>
    <body style="margin: 0; padding: 24px 16px; background: ${BRAND.bg}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="${containerStyle}">
            ${headerHTML}
            <div style="${bodyStyle}">
                <div style="text-align: center; margin-bottom: 40px;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ede9fe, #ddd6fe); border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 36px;">${statusIcon}</div>
                    <h2 style="color: ${BRAND.text}; font-size: 26px; font-weight: 900; margin: 0 0 8px;">Your Result is Here!</h2>
                    <p style="color: ${BRAND.muted}; font-size: 14px; margin: 0;">${testTitle}</p>
                </div>

                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
                    Hi <strong style="color: ${BRAND.primary};">${name}</strong>,<br>
                    Your test has been submitted and evaluated. Here are your results:
                </p>

                <!-- Score Card -->
                <div style="background: linear-gradient(135deg, ${BRAND.primaryDark}, ${BRAND.primary}); border-radius: 20px; padding: 32px; text-align: center; margin-bottom: 28px;">
                    <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Your Score</p>
                    <h1 style="color: ${BRAND.white}; font-size: 56px; font-weight: 900; margin: 0 0 4px; line-height: 1;">${score}/${totalQuestions}</h1>
                    <p style="color: rgba(255,255,255,0.8); font-size: 20px; font-weight: 700; margin: 0;">${percentage.toFixed(1)}%</p>
                    <div style="display: inline-block; background: ${statusBg}; color: ${statusColor}; padding: 8px 24px; border-radius: 50px; font-size: 13px; font-weight: 900; margin-top: 16px; letter-spacing: 1px;">
                        ${statusText}
                    </div>
                </div>

                <!-- Breakdown -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
                    <div style="background: #dcfce7; border-radius: 16px; padding: 20px; text-align: center;">
                        <p style="color: #166534; font-size: 28px; font-weight: 900; margin: 0;">${correctAnswers}</p>
                        <p style="color: #166534; font-size: 12px; font-weight: 700; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 1px;">Correct ✅</p>
                    </div>
                    <div style="background: #fee2e2; border-radius: 16px; padding: 20px; text-align: center;">
                        <p style="color: #991b1b; font-size: 28px; font-weight: 900; margin: 0;">${wrongAnswers}</p>
                        <p style="color: #991b1b; font-size: 12px; font-weight: 700; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 1px;">Wrong ❌</p>
                    </div>
                </div>

                <div style="background: ${isPassed ? '#f0fdf4' : '#fff7ed'}; border: 1px solid ${isPassed ? '#bbf7d0' : '#fed7aa'}; border-radius: 14px; padding: 20px 24px; margin-bottom: 32px;">
                    <p style="color: ${isPassed ? '#166534' : '#9a3412'}; font-size: 13px; margin: 0; line-height: 1.7; font-weight: 500;">
                        ${isPassed ? '🎉' : '💪'} ${message}
                    </p>
                </div>

                <div style="text-align: center; margin-bottom: 40px;">
                    <a href="${BASE_URL}/dashboard/my-tests" style="${btnStyle()}">📊 View Detailed Result</a>
                </div>

                <p style="color: ${BRAND.muted}; font-size: 12px; text-align: center; margin: 0;">Pass threshold: 60% and above</p>
            </div>
            ${footerHTML}
        </div>
    </body></html>`;
};
