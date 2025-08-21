const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    user_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone_number: { type: String, required: false, unique: true, sparse: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    subscription_validity: { type: Date },
    subscription_type: { type: String, enum: ['basic', 'standard', 'premium'], default: 'basic' },
    book_id: { type: String, default: null },
    role: { type: String, default: 'user' },
    deposit_status: { type: String, enum: ['n/a', 'deposited', 'refunded'], default: 'n/a' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    state: String,
    district: String,
    pincode: String,
    isVerified: { type: Boolean, default: false },
    otp: String, // Will be hashed automatically in pre-save hook
    otpExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
});

// Pre-save hook to handle hashing
userSchema.pre('save', async function (next) {
    try {
        // Generate user_id if it doesn't exist
        if (!this.user_id) {
            const timestamp = Date.now().toString();
            const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            this.user_id = `USER_${timestamp}_${randomNum}`;
        }

        // Hash password if it's been modified and exists and is not already hashed
        if (this.isModified('password') && this.password && !this.password.startsWith('$2')) {
            console.log('Hashing password...');
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
            console.log('Password hashed successfully');
        }

        // Hash OTP if it's been modified and exists and is not already hashed
        if (this.isModified('otp') && this.otp && !this.otp.startsWith('$2')) {
            console.log('Hashing OTP...', 'Original OTP:', this.otp);
            const salt = await bcrypt.genSalt(10);
            this.otp = await bcrypt.hash(this.otp, salt);
            console.log('OTP hashed successfully', 'Hashed OTP:', this.otp);
        }

        // Update updatedAt timestamp
        this.updatedAt = new Date();

        next();
    } catch (err) {
        console.error('Error in pre-save hook:', err.message);
        next(err);
    }
});

// Add a method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) {
        return false;
    }
    return await bcrypt.compare(candidatePassword, this.password);
};

// Add a method to compare OTP
userSchema.methods.compareOTP = async function(candidateOTP) {
    if (!this.otp) {
        console.log('No OTP stored');
        return false;
    }
    
    console.log('Comparing OTP:', {
        candidateOTP,
        storedOTPExists: !!this.otp,
        isHashed: this.otp.startsWith('$2')
    });
    
    // Since we're now always hashing OTP, we can simply use bcrypt.compare
    try {
        const result = await bcrypt.compare(candidateOTP, this.otp);
        console.log('OTP comparison result:', result);
        return result;
    } catch (error) {
        console.error('Error comparing OTP:', error);
        return false;
    }
};

// Add index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ user_id: 1 });
userSchema.index({ phone_number: 1 });
userSchema.index({ isVerified: 1, otpExpires: 1 });

module.exports = mongoose.model('User', userSchema);