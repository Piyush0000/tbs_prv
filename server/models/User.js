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
    otp: String,
    otpExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    // Coupon tracking
    usedCoupons: [{
        code: String,
        usedAt: { type: Date, default: Date.now },
        benefit: String // e.g., "first_month_free"
    }],
    hasUsedNewUserCoupon: { type: Boolean, default: false }, // Track if user has used new user coupon
    freeTrialUsed: { type: Boolean, default: false }, // Track if free trial was used
    freeTrialEndDate: Date, // When the free trial ends
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

// Method to check if user can use a specific coupon
userSchema.methods.canUseCoupon = function(couponCode) {
    // Check if user has already used this specific coupon
    const hasUsedThisCoupon = this.usedCoupons.some(coupon => coupon.code === couponCode);
    
    if (hasUsedThisCoupon) {
        return { valid: false, reason: 'Coupon already used' };
    }

    // For new user coupons, check if user has already used any new user coupon
    const newUserCoupons = ["DINKY100", "KAVYA100", "LEO100", "KASIS100"];
    if (newUserCoupons.includes(couponCode) && this.hasUsedNewUserCoupon) {
        return { valid: false, reason: 'New user coupon already used' };
    }

    return { valid: true };
};

// Method to apply coupon
userSchema.methods.applyCoupon = function(couponCode, benefit) {
    const newUserCoupons = ["DINKY100", "KAVYA100", "LEO100", "KASIS100"];
    
    this.usedCoupons.push({
        code: couponCode,
        usedAt: new Date(),
        benefit: benefit
    });

    if (newUserCoupons.includes(couponCode)) {
        this.hasUsedNewUserCoupon = true;
    }
};

module.exports = mongoose.model('User', userSchema);