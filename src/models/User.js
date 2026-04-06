const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: function() { return !this.isOTPLogin; } },
    role: { 
        type: String, 
        enum: ['administrator', 'super_admin', 'college_admin', 'student', 'user'], 
        default: 'user' 
    },
    userType: {
        type: String,
        enum: ['college_admin', 'college_student', 'individual_user'],
        required: true,
        default: function() {
            if (this.role === 'college_admin') return 'college_admin';
            if (this.role === 'student') return 'college_student';
            return 'individual_user';
        }
    },
    studentId: { type: String, unique: true, sparse: true }, // For student login
    rollNumber: { type: String, sparse: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },
    divisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', default: null },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'active' },
    verificationToken: { type: String, default: null },
    verificationTokenExpires: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    profileImage: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    lastLogin: { type: Date, default: null },
    lastSeen: { type: Date, default: Date.now },
    credentialPassEncrypted: { type: String, default: null },
    // OTP Fields
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },
    otpLockUntil: { type: Date, default: null },
}, { timestamps: true });

userSchema.pre('save', async function() {
    if (!this.isModified('password') || !this.password) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
