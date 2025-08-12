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
    otp: String,
    otpExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
});

userSchema.pre('save', async function (next) {
    try {
        if (this.isNew) {
            console.log('Generating user_id for new user...');
            const lastUser = await mongoose.models.User.findOne().sort({ createdAt: -1 });
            console.log('Last user found:', lastUser);
            let userIdNumber;
            if (lastUser) {
                userIdNumber = parseInt(lastUser.user_id.split('_')[1], 10) + 1;
            } else {
                userIdNumber = 1;
            }
            this.user_id = `User_${String(userIdNumber).padStart(3, '0')}`;
            console.log('Generated user_id:', this.user_id);
        }

        if (this.isModified('password') && this.password) {
            console.log('Hashing password...');
            this.password = await bcrypt.hash(this.password, 10);
            console.log('Password hashed successfully');
        } else {
            console.log('Skipping password hashing (Firebase user or unchanged password)');
        }

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

module.exports = mongoose.model('User', userSchema);


/* //previous code
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
});

userSchema.pre('save', async function (next) {
    try {
        if (this.isNew) {
            console.log('Generating user_id for new user...');
            const lastUser = await mongoose.models.User.findOne().sort({ createdAt: -1 });
            console.log('Last user found:', lastUser);
            let userIdNumber;
            if (lastUser) {
                userIdNumber = parseInt(lastUser.user_id.split('_')[1], 10) + 1;
            } else {
                userIdNumber = 1;
            }
            this.user_id = `User_${String(userIdNumber).padStart(3, '0')}`;
            console.log('Generated user_id:', this.user_id);
        }

        if (this.isModified('password') && this.password) {
            console.log('Hashing password...');
            this.password = await bcrypt.hash(this.password, 10);
            console.log('Password hashed successfully');
        }

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

module.exports = mongoose.model('User', userSchema); */