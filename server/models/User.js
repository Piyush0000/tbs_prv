const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    user_id: { 
        type: String, 
        required: false,
        unique: true, 
        sparse: true
    },
    name: { type: String, required: true },
    phone_number: { type: String, required: false, unique: true, sparse: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    book_id: { type: String, default: null },
    role: { type: String, default: 'user' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    
    // Personal Information
    gender: { type: String, enum: ['male', 'female', 'other'] },
    state: String,
    district: String,
    pincode: String,
    
    // Verification fields
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    
    // Deposit Information
    deposit_status: {
        type: String,
        enum: ['not_paid', 'deposited', 'refunded'],
        default: 'not_paid'
    },
    deposit_amount: {
        type: Number,
        default: 0
    },
    deposit_paid_at: {
        type: Date,
        default: null
    },
    
    // Subscription Information
    subscription_type: {
        type: String,
        enum: ['basic', 'standard', 'premium'],
        default: 'basic'
    },
    subscription_validity: {
        type: Date,
        default: null
    },
    subscription_started_at: {
        type: Date,
        default: null
    },
    subscription_cancelled_at: {
        type: Date,
        default: null
    },
    
    // Razorpay subscription ID for recurring payments
    razorpay_subscription_id: {
        type: String,
        default: null
    },
    
    // Used coupons tracking
    used_coupons: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CouponCode',
        default: []
    }]
});

userSchema.pre('save', async function (next) {
    try {
        // Generate user_id only for new users
        if (this.isNew && !this.user_id) {
            console.log('Generating user_id for new user...');

            // Find the last inserted user_id
            const lastUser = await mongoose.models.User.findOne({})
                .sort({ createdAt: -1 })
                .select('user_id');

            let userIdNumber = 1;
            if (lastUser && lastUser.user_id) {
                const lastNum = parseInt(lastUser.user_id.split('_')[1], 10);
                userIdNumber = lastNum + 1;
            }

            this.user_id = `User_${String(userIdNumber).padStart(3, '0')}`;
            console.log('Generated user_id:', this.user_id);
        }

        // Hash password if needed - CONSISTENT SALT ROUNDS
        if (this.isModified('password') && this.password) {
            console.log('Hashing password...');
            const saltRounds = 10; // Consistent with auth.js
            this.password = await bcrypt.hash(this.password, saltRounds);
            console.log('Password hashed successfully');
        }

        // Update updatedAt on modification
        if (!this.isNew) {
            console.log('Updating updatedAt...');
            this.updatedAt = Date.now();
        }

        next();
    } catch (err) {
        console.error('Error in pre-save hook:', err.message);
        next(err);
    }
});

// Validation to ensure user_id is always set after save
userSchema.post('save', function(doc) {
    if (!doc.user_id) {
        console.error('CRITICAL: User saved without user_id:', doc._id);
    } else {
        console.log('User saved successfully with user_id:', doc.user_id);
    }
});

// Add method to check if OTP is valid
userSchema.methods.isOTPValid = function(providedOTP) {
    // Check if OTP exists and hasn't expired
    if (!this.otp || !this.otpExpires) {
        return false;
    }
    
    // Check if OTP has expired
    if (new Date() > this.otpExpires) {
        return false;
    }
    
    // Compare OTP (direct string comparison)
    return this.otp === providedOTP.trim();
};

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error('Password comparison error:', error);
        return false;
    }
};

// Method to check if subscription is active
userSchema.methods.hasActiveSubscription = function() {
    return this.subscription_type && 
           this.subscription_type !== 'basic' &&
           this.subscription_validity && 
           this.subscription_validity > new Date() &&
           this.deposit_status === 'deposited';
};

// Method to check if user can request books
userSchema.methods.canRequestBook = function() {
    return this.hasActiveSubscription() && 
           (this.subscription_type !== 'basic' || !this.book_id);
};

// Method to get subscription days remaining
userSchema.methods.getSubscriptionDaysRemaining = function() {
    if (!this.subscription_validity) return 0;
    
    const now = new Date();
    const validity = new Date(this.subscription_validity);
    const diffTime = validity - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
};

// Method to check if user can use a specific coupon
userSchema.methods.canUseCoupon = function(couponId) {
    return !this.used_coupons || !this.used_coupons.includes(couponId);
};

module.exports = mongoose.model('User', userSchema);