const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOTPEmail, testEmailConnection } = require('../utils/mailer');

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user and send OTP
 * @access  Public
 */
router.post('/signup', async (req, res) => {
    console.log('\n=== SIGNUP PROCESS START ===');
    console.log('Request body:', req.body);
    
    try {
        const { name, phone_number, email, password } = req.body;

        console.log('1. Extracted data:', { name, phone_number, email, password: '***' });

        // Validation
        if (!name || !phone_number || !email || !password) {
            console.log('❌ Validation failed: Missing required fields');
            return res.status(400).json({ message: "All fields are required" });
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            console.log('❌ Validation failed: Invalid email format');
            return res.status(400).json({ message: "Invalid email format" });
        }
        
        if (password.length < 8 || !/[!@#$%^&*]/.test(password)) {
            console.log('❌ Validation failed: Invalid password');
            return res.status(400).json({ message: "Password must be 8+ characters with a special character" });
        }
        
        if (!/^\d{10}$/.test(phone_number)) {
            console.log('❌ Validation failed: Invalid phone number');
            return res.status(400).json({ message: "Phone number must be 10 digits" });
        }

        console.log('✅ All validations passed');

        // Test email connection first
        console.log('1.5. Testing email connection...');
        const emailConnectionOk = await testEmailConnection();
        if (!emailConnectionOk) {
            console.log('❌ Email connection failed');
            return res.status(500).json({ 
                message: "Email service is currently unavailable. Please try again later." 
            });
        }
        console.log('✅ Email connection verified');

        // Check if user already exists
        console.log('2. Checking for existing user...');
        const existingUser = await User.findOne({ 
            email: { $regex: new RegExp(`^${email}$`, 'i') } 
        });
        
        if (existingUser) {
            console.log('Found existing user:', {
                id: existingUser._id,
                email: existingUser.email,
                isVerified: existingUser.isVerified
            });
            
            if (existingUser.isVerified) {
                console.log('❌ User already exists and verified');
                return res.status(400).json({ 
                    message: "An account with this email already exists and is verified." 
                });
            } else {
                console.log('Deleting unverified existing user...');
                await User.deleteOne({ _id: existingUser._id });
                console.log('✅ Unverified user deleted');
            }
        } else {
            console.log('✅ No existing user found');
        }

        // Generate OTP
        console.log('3. Generating OTP...');
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        console.log('Generated OTP:', otp);
        console.log('OTP expires at:', otpExpires);
        console.log('OTP type:', typeof otp);

        // Create new user
        console.log('4. Creating new user object...');
        const newUser = new User({
            name,
            phone_number,
            email: email.toLowerCase(),
            password,
            otp,
            otpExpires,
            isVerified: false,
            role: 'user'
        });

        console.log('User object created, OTP stored as:', newUser.otp);
        console.log('About to save user...');

        // Save user
        console.log('5. Saving user to database...');
        const savedUser = await newUser.save();
        
        console.log('✅ User saved successfully!');
        console.log('User ID:', savedUser._id);
        console.log('Generated user_id:', savedUser.user_id);
        console.log('Saved OTP in DB:', savedUser.otp);
        
        // Verify the user was actually saved with OTP
        console.log('6. Verifying user in database...');
        const verifyUser = await User.findById(savedUser._id);
        console.log('Verification - User exists:', !!verifyUser);
        console.log('Verification - OTP in DB:', verifyUser ? verifyUser.otp : 'USER NOT FOUND');
        console.log('Verification - OTP Expires:', verifyUser ? verifyUser.otpExpires : 'USER NOT FOUND');
        
        if (!verifyUser) {
            console.log('❌ CRITICAL: User not found after save!');
            return res.status(500).json({ message: "User creation failed - not saved to database" });
        }
        
        if (!verifyUser.otp) {
            console.log('❌ CRITICAL: OTP not saved to database!');
            return res.status(500).json({ message: "OTP not saved to database" });
        }

        // Send OTP email
        console.log('7. Attempting to send OTP email...');
        try {
            // Check if sendOTPEmail is available
            if (typeof sendOTPEmail !== 'function') {
                throw new Error('sendOTPEmail is not a function - check mailer import');
            }
            
            const emailResult = await sendOTPEmail(savedUser.email, otp);
            console.log('✅ Email sent successfully');
            console.log('Email result:', emailResult);
            
        } catch (emailError) {
            console.log('❌ Email sending failed:', emailError.message);
            console.log('Email error details:', emailError);
            
            // Delete the user since email failed
            await User.deleteOne({ _id: savedUser._id });
            console.log('User deleted due to email failure');
            
            return res.status(500).json({ 
                message: "Failed to send verification email. Please try again.",
                error: emailError.message
            });
        }

        console.log('8. Signup process completed successfully');
        console.log('=== SIGNUP PROCESS END ===\n');

        res.status(201).json({ 
            message: "Registration successful! Please check your email for an OTP to verify your account.",
            debug: {
                userId: savedUser._id,
                userIdGenerated: savedUser.user_id,
                otpSaved: !!savedUser.otp,
                emailSent: true
            }
        });
        
    } catch (error) {
        console.log('❌ SIGNUP ERROR:', error.message);
        console.log('Error stack:', error.stack);
        console.log('Error details:', error);
        console.log('=== SIGNUP PROCESS END (ERROR) ===\n');
        
        res.status(500).json({ 
            message: "Internal server error",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify user's email with OTP
 * @access  Public
 */
router.post('/verify-otp', async (req, res) => {
    console.log('\n=== OTP VERIFICATION START ===');
    console.log('Request body:', req.body);
    
    try {
        const { email, otp } = req.body;

        console.log('OTP verification request:', { email, otp });

        // Enhanced validation with better error messages
        if (!email || email.trim() === '') {
            return res.status(400).json({ message: "Email is required." });
        }
        
        if (!otp || otp.trim() === '') {
            return res.status(400).json({ message: "OTP is required." });
        }

        // Validate OTP format (should be 6 digits)
        const cleanOtp = otp.trim();
        if (!/^\d{6}$/.test(cleanOtp)) {
            return res.status(400).json({ message: "OTP must be exactly 6 digits." });
        }

        const cleanEmail = email.toLowerCase().trim();
        
        console.log('Looking for user with email:', cleanEmail);
        
        // Find user with matching email and valid OTP expiration
        const user = await User.findOne({
            email: cleanEmail,
            otpExpires: { $gt: Date.now() },
            isVerified: false
        });

        if (!user) {
            console.log('User not found or OTP expired for email:', cleanEmail);
            // Check if user exists at all
            const userExists = await User.findOne({ email: cleanEmail });
            if (!userExists) {
                console.log('No user found with this email');
                return res.status(400).json({ 
                    message: "User not found. Please register first." 
                });
            } else if (userExists.isVerified) {
                console.log('User already verified');
                return res.status(400).json({ 
                    message: "Account already verified. Please sign in.",
                    redirectTo: "/auth/signin"
                });
            } else {
                console.log('OTP expired for user');
                return res.status(400).json({ 
                    message: "OTP has expired. Please request a new one." 
                });
            }
        }

        console.log('User found:', user._id);
        console.log('Stored OTP:', user.otp);
        console.log('Provided OTP:', cleanOtp);

        // Compare OTP (direct comparison since we're storing as plain text)
        if (user.otp !== cleanOtp) {
            console.log('OTP mismatch');
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        console.log('OTP verified successfully');

        // OTP is correct, verify the user
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();
        
        console.log('User verified and saved');
        console.log('=== OTP VERIFICATION END ===\n');
        
        res.status(200).json({ 
            message: "Email verified successfully! Redirecting to sign in...",
            redirectTo: "/auth/signin"
        });

    } catch (error) {
        console.error("OTP Verification Error:", error);
        console.error("Error stack:", error.stack);
        console.log('=== OTP VERIFICATION END (ERROR) ===\n');
        
        // More specific error handling
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid data format." });
        }
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: "Validation error: " + error.message });
        }
        
        res.status(500).json({ message: "Internal server error: " + error.message });
    }
});

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP to unverified user
 * @access  Public
 */
router.post('/resend-otp', async (req, res) => {
    console.log('\n=== RESEND OTP START ===');
    
    try {
        const { email } = req.body;

        console.log('Resend OTP request for:', email);

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            isVerified: false
        });

        if (!user) {
            console.log('No unverified user found for email:', email);
            return res.status(400).json({ 
                message: "User not found or already verified" 
            });
        }

        // Generate new OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        console.log('Generated new OTP:', otp);

        user.otp = otp; // Store as plain text
        user.otpExpires = otpExpires;
        await user.save();

        console.log('Updated user with new OTP');

        // Send new OTP
        try {
            await sendOTPEmail(user.email, otp);
            console.log('Resend OTP email sent successfully');
        } catch (emailError) {
            console.error('Failed to send resend OTP email:', emailError);
            return res.status(500).json({ message: "Failed to send OTP email" });
        }

        console.log('=== RESEND OTP END ===\n');
        
        res.status(200).json({ 
            message: "New OTP sent to your email" 
        });

    } catch (error) {
        console.error("Resend OTP Error:", error);
        console.log('=== RESEND OTP END (ERROR) ===\n');
        res.status(500).json({ message: "Internal server error: " + error.message });
    }
});

module.exports = router;