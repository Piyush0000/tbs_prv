const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOTPEmail } = require('../utils/mailer');

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user and send OTP
 * @access  Public
 */
router.post('/signup', async (req, res) => {
    try {
        const { name, phone_number, email, password } = req.body;

        // Validation
        if (!name || !phone_number || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        
        // Trim and normalize inputs
        const cleanName = name.trim();
        const cleanPhone = phone_number.trim();
        const cleanEmail = email.trim().toLowerCase();
        
        if (!cleanName || !cleanPhone || !cleanEmail || !password) {
            return res.status(400).json({ message: "All fields must contain valid data" });
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
        if (password.length < 8 || !/[!@#$%^&*]/.test(password)) {
            return res.status(400).json({ message: "Password must be 8+ characters with a special character" });
        }
        if (!/^\d{10}$/.test(cleanPhone)) {
            return res.status(400).json({ message: "Phone number must be exactly 10 digits" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ 
            email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        });
        
        if (existingUser) {
            if (existingUser.isVerified) {
                return res.status(400).json({ 
                    message: "An account with this email already exists and is verified. Please sign in instead." 
                });
            } else {
                // User exists but not verified - delete the old record and create new one
                await User.deleteOne({ _id: existingUser._id });
            }
        }

        // Generate OTP (6 digits)
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        console.log('Generated OTP (plain text):', otp);

        // Create new user - OTP and password will be automatically hashed by pre-save hook
        const newUser = new User({
            name: cleanName,
            phone_number: cleanPhone,
            email: cleanEmail,
            password, // Will be hashed by pre-save hook
            otp: otp, // Will be hashed by pre-save hook
            otpExpires,
            isVerified: false,
            role: 'user'
        });

        // Save user - this will trigger the pre-save hook to hash password and OTP
        await newUser.save();
        
        console.log('User saved. OTP should now be hashed in database.');
        console.log('Stored OTP starts with $2:', newUser.otp ? newUser.otp.startsWith('$2') : false);
        
        // Send OTP email with the ORIGINAL plain text OTP (not the hashed one)
        await sendOTPEmail(cleanEmail, otp);

        res.status(201).json({ 
            message: "Registration successful! Please check your email for a 6-digit OTP to verify your account." 
        });
        
    } catch (error) {
        console.error("Signup Error:", error);
        
        if (error.code === 11000) {
            return res.status(400).json({ message: "An account with this email already exists" });
        }
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        
        res.status(500).json({ message: "Registration failed. Please try again." });
    }
});

/**
 * @route   POST /api/auth/signup/verify
 * @desc    Verify user's email with OTP
 * @access  Public
 */
router.post('/signup/verify', async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Enhanced validation
        if (!email || typeof email !== 'string' || email.trim() === '') {
            return res.status(400).json({ message: "Valid email is required" });
        }
        
        if (!otp || typeof otp !== 'string' || otp.trim() === '') {
            return res.status(400).json({ message: "OTP is required" });
        }

        // Clean and validate inputs
        const cleanEmail = email.trim().toLowerCase();
        const cleanOtp = otp.trim();
        
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
        
        // Validate OTP format (should be exactly 6 digits)
        if (!/^\d{6}$/.test(cleanOtp)) {
            return res.status(400).json({ message: "OTP must be exactly 6 digits" });
        }
        
        // Find user with matching email and valid OTP expiration
        const user = await User.findOne({
            email: cleanEmail,
            otpExpires: { $gt: Date.now() },
            isVerified: false
        });

        if (!user) {
            return res.status(400).json({ 
                message: "User not found, OTP expired, or account already verified. Please register again if needed." 
            });
        }

        // Check if user has OTP stored
        if (!user.otp) {
            return res.status(400).json({ 
                message: "No OTP found for this account. Please request a new one." 
            });
        }

        console.log('OTP Verification Debug:', {
            email: cleanEmail,
            providedOTP: cleanOtp,
            storedOTPExists: !!user.otp,
            isStoredOTPHashed: user.otp.startsWith('$2'),
            storedOTPLength: user.otp.length
        });

        // Compare OTP using the model method
        const isOTPValid = await user.compareOTP(cleanOtp);
        console.log('OTP comparison result:', isOTPValid);

        if (!isOTPValid) {
            return res.status(400).json({ message: "Invalid OTP. Please check and try again." });
        }

        // OTP is correct, verify the user
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        
        await user.save();
        
        // Generate JWT token for auto-login
        const token = jwt.sign(
            { 
                id: user._id, 
                role: user.role,
                email: user.email 
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        res.status(200).json({ 
            message: "Email verified successfully! Welcome aboard!", 
            token,
            user: { 
                id: user._id, 
                user_id: user.user_id,
                email: user.email, 
                role: user.role,
                name: user.name 
            }
        });

    } catch (error) {
        console.error("OTP Verification Error:", error);
        
        // Handle specific error types
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid data provided" });
        }
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: "Validation error: " + error.message });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(500).json({ message: "Authentication setup failed. Please contact support." });
        }
        
        res.status(500).json({ message: "Verification failed. Please try again." });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login a user (only if verified)
 * @access  Public
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Find user by email
        const user = await User.findOne({ 
            email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        });
        
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        
        // Check if the user's email is verified
        if (!user.isVerified) {
            return res.status(401).json({ 
                error: 'Your account is not verified. Please check your email for verification instructions or register again.',
                needsVerification: true
            });
        }

        // Check password using model method
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        
        // Generate token
        const token = jwt.sign(
            { 
                id: user._id, 
                role: user.role,
                email: user.email 
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        res.status(200).json({ 
            message: 'Login successful',
            token, 
            user: { 
                id: user._id,
                user_id: user.user_id, 
                email: user.email, 
                role: user.role,
                name: user.name 
            } 
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP to unverified user
 * @access  Public
 */
router.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string' || email.trim() === '') {
            return res.status(400).json({ message: "Valid email is required" });
        }

        const cleanEmail = email.trim().toLowerCase();
        
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const user = await User.findOne({
            email: cleanEmail,
            isVerified: false
        });

        if (!user) {
            return res.status(400).json({ 
                message: "User not found or already verified. Please register if you don't have an account." 
            });
        }

        // Generate new OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        console.log('Resending OTP (plain text):', otp);

        // Set new OTP - it will be automatically hashed by pre-save hook
        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        console.log('New OTP saved. Should be hashed:', user.otp.startsWith('$2'));

        // Send new OTP email with the ORIGINAL plain text OTP
        await sendOTPEmail(cleanEmail, otp);

        res.status(200).json({ 
            message: "New OTP has been sent to your email. Please check your inbox." 
        });

    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(500).json({ message: "Failed to resend OTP. Please try again." });
    }
});

module.exports = router;