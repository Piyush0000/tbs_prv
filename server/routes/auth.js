const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOTPEmail, testEmailConnection } = require('../utils/mailer');

// Import Transaction model (this was missing)
const Transaction = require('../models/Transaction');

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile from httpOnly cookie
 * @access  Private
 */
router.get('/profile', async (req, res) => {
    try {
        console.log('Profile check - Headers:', req.headers);
        console.log('Profile check - Cookies:', req.cookies);
        
        let token = null;
        
        // First, try to get token from cookies
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
            console.log('Token found in cookies');
        }
        // If not in cookies, try Authorization header
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.substring(7);
            console.log('Token found in Authorization header');
        }
        
        if (!token) {
            console.log('No token found in cookies or headers');
            return res.status(401).json({ 
                message: 'No token provided',
                isAuthenticated: false 
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token decoded successfully:', decoded);
            
            // Get user from database
            const user = await User.findById(decoded.id).select('-password -otp -otpExpires');
            
            if (!user) {
                console.log('User not found for decoded token');
                return res.status(401).json({ 
                    message: 'User not found',
                    isAuthenticated: false 
                });
            }

            console.log('Profile check successful for user:', user.email);
            res.status(200).json({
                isAuthenticated: true,
                user: {
                    id: user._id,
                    user_id: user.user_id,
                    name: user.name,
                    email: user.email,
                    phone_number: user.phone_number,
                    role: user.role,
                    isVerified: user.isVerified
                }
            });
        } catch (tokenError) {
            console.log('Token verification failed:', tokenError.message);
            return res.status(401).json({ 
                message: 'Invalid token',
                isAuthenticated: false 
            });
        }
    } catch (error) {
        console.error('Profile check error:', error);
        res.status(500).json({ 
            message: 'Internal server error',
            isAuthenticated: false 
        });
    }
});

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

        // Test email connection first - Add error handling
        console.log('1.5. Testing email connection...');
        try {
            const emailConnectionOk = await testEmailConnection();
            if (!emailConnectionOk) {
                console.log('❌ Email connection failed');
                return res.status(500).json({ 
                    message: "Email service is currently unavailable. Please try again later." 
                });
            }
            console.log('✅ Email connection verified');
        } catch (emailTestError) {
            console.log('❌ Email connection test failed:', emailTestError.message);
            return res.status(500).json({ 
                message: "Email service configuration error. Please try again later." 
            });
        }

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

        // Create new user
        console.log('4. Creating new user object...');
        const newUser = new User({
            name,
            phone_number,
            email: email.toLowerCase(),
            password, // Let the pre-save hook handle hashing
            otp,
            otpExpires,
            isVerified: false,
            role: 'user'
        });

        console.log('User object created, OTP stored as:', newUser.otp);

        // Save user
        console.log('5. Saving user to database...');
        const savedUser = await newUser.save();
        
        console.log('✅ User saved successfully!');
        console.log('User ID:', savedUser._id);
        console.log('Generated user_id:', savedUser.user_id);
        
        // Send OTP email
        console.log('6. Attempting to send OTP email...');
        try {
            const emailResult = await sendOTPEmail(savedUser.email, otp);
            console.log('✅ Email sent successfully');
            
        } catch (emailError) {
            console.log('❌ Email sending failed:', emailError.message);
            
            // Delete the user since email failed
            await User.deleteOne({ _id: savedUser._id });
            console.log('User deleted due to email failure');
            
            return res.status(500).json({ 
                message: "Failed to send verification email. Please try again.",
                error: emailError.message
            });
        }

        console.log('7. Signup process completed successfully');
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
        console.log('=== SIGNUP PROCESS END (ERROR) ===\n');
        
        // Handle specific MongoDB errors
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: "User with this email or phone number already exists" 
            });
        }
        
        res.status(500).json({ 
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred during registration'
        });
    }
});

/**
 * @route   GET /api/users/:user_id (MOVED TO CORRECT PLACE)
 * @desc    Get a specific user by user_id (for QR scanner)
 * @access  Public
 */
router.get('/users/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        console.log('Looking for user with user_id:', user_id);
        
        // Find user by user_id
        const user = await User.findOne({ user_id: user_id });
        
        if (!user) {
            console.log('User not found:', user_id);
            return res.status(404).json({ 
                error: 'User not found',
                requestedId: user_id
            });
        }
        
        console.log('User found:', user.name, 'with user_id:', user.user_id);
        
        // Return user data (excluding sensitive information)
        res.status(200).json({
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            phone_number: user.phone_number,
            subscription_type: user.subscription_type,
            subscription_validity: user.subscription_validity,
            book_id: user.book_id,
            role: user.role,
            deposit_status: user.deposit_status,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        });
        
    } catch (err) {
        console.error('Error fetching user:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route   POST /api/auth/signin
 * @desc    Sign in a user
 * @access  Public
 */
router.post('/signin', async (req, res) => {
    console.log('\n=== SIGNIN PROCESS START ===');
    console.log('Request body:', { email: req.body.email, password: '***' });
    
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            console.log('❌ Validation failed: Missing email or password');
            return res.status(400).json({ message: "Email and password are required" });
        }

        console.log('1. Looking for user with email:', email);

        // Find user by email (case insensitive)
        const user = await User.findOne({ 
            email: { $regex: new RegExp(`^${email}$`, 'i') }
        });

        if (!user) {
            console.log('❌ User not found');
            return res.status(400).json({ message: "Invalid email or password" });
        }

        console.log('2. User found:', {
            id: user._id,
            email: user.email,
            isVerified: user.isVerified,
            role: user.role
        });

        // Check if user is verified
        if (!user.isVerified) {
            console.log('❌ User not verified');
            return res.status(400).json({ 
                message: "Please verify your email before signing in",
                requiresVerification: true
            });
        }

        console.log('3. Checking password...');

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            console.log('❌ Invalid password');
            return res.status(400).json({ message: "Invalid email or password" });
        }

        console.log('✅ Password valid');

        // Generate JWT token
        console.log('4. Generating JWT token...');
        const token = jwt.sign(
            { 
                id: user._id, 
                email: user.email,
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('✅ Token generated');

        // Set cookie options
        console.log('5. Setting cookie...');
        const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE || '7', 10);
        const cookieOptions = {
            expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        };

        // Set the token in cookie
        res.cookie('token', token, cookieOptions);
        console.log('✅ Token saved in cookie');

        // Prepare user data for response
        const userData = {
            id: user._id,
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            phone_number: user.phone_number,
            role: user.role,
            isVerified: user.isVerified
        };

        console.log('6. Signin successful for user:', userData.email);
        console.log('=== SIGNIN PROCESS END ===\n');

        res.status(200).json({
            message: "Sign in successful",
            token, // Still sending token for compatibility
            user: userData
        });

    } catch (error) {
        console.log('❌ SIGNIN ERROR:', error.message);
        console.log('=== SIGNIN PROCESS END (ERROR) ===\n');
        
        res.status(500).json({ 
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Sign in failed'
        });
    }
});

/**
 * @route   POST /api/auth/signout
 * @desc    Sign out a user by clearing the cookie
 * @access  Public
 */
router.post('/signout', (req, res) => {
    console.log('\n=== SIGNOUT PROCESS START ===');
    
    try {
        // Clear the token cookie
        res.cookie('token', '', {
            expires: new Date(0),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });
        
        console.log('✅ Token cookie cleared');
        console.log('=== SIGNOUT PROCESS END ===\n');
        
        res.status(200).json({
            message: "Signed out successfully"
        });
        
    } catch (error) {
        console.log('❌ SIGNOUT ERROR:', error.message);
        console.log('=== SIGNOUT PROCESS END (ERROR) ===\n');
        
        res.status(500).json({ 
            message: "Internal server error"
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

        // Validation
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }

        const cleanOtp = otp.trim();
        if (!/^\d{6}$/.test(cleanOtp)) {
            return res.status(400).json({ message: "OTP must be exactly 6 digits" });
        }

        const cleanEmail = email.toLowerCase().trim();
        
        // Find user with matching email and valid OTP expiration
        const user = await User.findOne({
            email: cleanEmail,
            otpExpires: { $gt: Date.now() },
            isVerified: false
        });

        if (!user) {
            // Check if user exists at all
            const userExists = await User.findOne({ email: cleanEmail });
            if (!userExists) {
                return res.status(400).json({ 
                    message: "User not found. Please register first." 
                });
            } else if (userExists.isVerified) {
                return res.status(400).json({ 
                    message: "Account already verified. Please sign in." 
                });
            } else {
                return res.status(400).json({ 
                    message: "OTP has expired. Please request a new one." 
                });
            }
        }

        // Compare OTP
        if (user.otp !== cleanOtp) {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        // OTP is correct, verify the user
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();
        
        console.log('User verified successfully');
        console.log('=== OTP VERIFICATION END ===\n');
        
        res.status(200).json({ 
            message: "Email verified successfully! You can now sign in." 
        });

    } catch (error) {
        console.error("OTP Verification Error:", error);
        console.log('=== OTP VERIFICATION END (ERROR) ===\n');
        
        res.status(500).json({ 
            message: "Internal server error" 
        });
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

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            isVerified: false
        });

        if (!user) {
            return res.status(400).json({ 
                message: "User not found or already verified" 
            });
        }

        // Generate new OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

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
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send OTP for password reset
 * @access  Public
 */
router.post('/forgot-password', async (req, res) => {
    console.log('\n=== FORGOT PASSWORD START ===');
    
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            isVerified: true
        });

        if (!user) {
            return res.status(400).json({ 
                message: "User not found" 
            });
        }

        // Generate new OTP for password reset
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // Send OTP email
        try {
            await sendOTPEmail(user.email, otp);
            console.log('Password reset OTP email sent successfully');
        } catch (emailError) {
            console.error('Failed to send password reset OTP email:', emailError);
            return res.status(500).json({ message: "Failed to send OTP email" });
        }

        console.log('=== FORGOT PASSWORD END ===\n');
        
        res.status(200).json({ 
            message: "OTP sent to your email for password reset" 
        });

    } catch (error) {
        console.error("Forgot Password Error:", error);
        console.log('=== FORGOT PASSWORD END (ERROR) ===\n');
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with OTP
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
    console.log('\n=== RESET PASSWORD START ===');
    
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: "Email, OTP, and new password are required" });
        }

        // Validate new password
        if (newPassword.length < 8 || !/[!@#$%^&*]/.test(newPassword)) {
            return res.status(400).json({ 
                message: "Password must be 8+ characters with a special character" 
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            isVerified: true,
            otpExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ 
                message: "User not found or OTP expired" 
            });
        }

        // Verify OTP
        if (user.otp !== otp.trim()) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // Set the plain password - let the pre-save hook handle hashing
        user.password = newPassword;
        user.otp = undefined;
        user.otpExpires = undefined;
        
        await user.save();

        console.log('Password reset successfully');
        console.log('=== RESET PASSWORD END ===\n');
        
        res.status(200).json({ 
            message: "Password reset successfully. You can now sign in with your new password." 
        });

    } catch (error) {
        console.error("Reset Password Error:", error);
        console.log('=== RESET PASSWORD END (ERROR) ===\n');
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * TRANSACTION ROUTES (MOVED TO SEPARATE SECTION)
 */

/**
 * @route   GET /api/transactions/:transaction_id
 * @desc    Get transaction details by transaction_id (for QR scanner)
 * @access  Public
 */
router.get('/transactions/:transaction_id', async (req, res) => {
    try {
        const { transaction_id } = req.params;
        console.log('Looking for transaction with transaction_id:', transaction_id);
        
        // Find transaction by transaction_id and populate related data
        const transaction = await Transaction.findOne({ 
            transaction_id: transaction_id 
        }).populate('book_id user_id cafe_id');
        
        if (!transaction) {
            console.log('Transaction not found:', transaction_id);
            return res.status(404).json({ 
                error: 'Transaction not found',
                requestedId: transaction_id
            });
        }
        
        console.log('Transaction found:', {
            id: transaction.transaction_id,
            book_id: transaction.book_id,
            user_id: transaction.user_id,
            status: transaction.status
        });
        
        // Return transaction data
        res.status(200).json({
            transaction_id: transaction.transaction_id,
            book_id: transaction.book_id,
            user_id: transaction.user_id,
            cafe_id: transaction.cafe_id,
            status: transaction.status,
            created_at: transaction.created_at,
            processed_at: transaction.processed_at
        });
        
    } catch (err) {
        console.error('Error fetching transaction:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route   PUT /api/transactions/approve/:transaction_id
 * @desc    Approve a transaction (update status to picked_up)
 * @access  Private (admin only)
 */
router.put('/transactions/approve/:transaction_id', async (req, res) => {
    try {
        const { transaction_id } = req.params;
        
        console.log('Approving transaction:', transaction_id);
        
        // Find and update transaction
        const transaction = await Transaction.findOneAndUpdate(
            { 
                transaction_id: transaction_id,
                status: 'pickup_pending'
            },
            { 
                status: 'picked_up',
                processed_at: new Date()
            },
            { new: true }
        );
        
        if (!transaction) {
            return res.status(404).json({ 
                error: 'Transaction not found or not in pickup_pending status' 
            });
        }
        
        console.log('Transaction approved successfully:', transaction.transaction_id);
        
        res.status(200).json({
            message: 'Transaction approved successfully',
            transaction: {
                transaction_id: transaction.transaction_id,
                book_id: transaction.book_id,
                user_id: transaction.user_id,
                cafe_id: transaction.cafe_id,
                status: transaction.status,
                processed_at: transaction.processed_at
            }
        });
        
    } catch (err) {
        console.error('Error approving transaction:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;