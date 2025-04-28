const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { admin, auth } = require('../config/firebaseAdmin');

router.post('/register', async (req, res) => {
    try {
        const { name, phone_number, email, password } = req.body;

        // Server-side validation
        if (!name || !phone_number || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
        if (password.length < 8 || !/[!@#$%^&*]/.test(password)) {
            return res.status(400).json({ message: "Password must be 8+ characters with a special character" });
        }
        if (!/^\d{10}$/.test(phone_number)) {
            return res.status(400).json({ message: "Phone number must be 10 digits" });
        }
        // Check if the user already exists (case-insensitive)
        let existingUser = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists." });
        }

        // Generate a unique user_id
        let count = await User.countDocuments();
        let user_id = `User_${String(count + 1).padStart(3, '0')}`; // e.g., User_001, User_002, ...

        // Create a new user with normalized email
        const newUser = new User({
            user_id,
            name,
            phone_number,
            email: email.toLowerCase(),
            password,
            role: 'user'
        });

        // Save to database
        await newUser.save();

        // Generate JWT Token
        const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ message: "User registered successfully!", token });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Case-insensitive email query
        const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        console.log('User found:', user); // Debug log
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        console.log('Generated token:', token); // Debug log
        res.status(200).json({ token, user: { id: user._id, email: user.email, role: user.role } });
    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/email-signup', async (req, res) => {
    try {
        const { idToken, name, email } = req.body;

        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (decodedToken.email !== email) {
            console.error(`Email mismatch: Firebase=${decodedToken.email}, Request=${email}`);
            return res.status(400).json({ message: 'Email mismatch' });
        }

        // Normalize email for query
        const normalizedEmail = email.toLowerCase();
        console.log(`Looking up user with email: ${normalizedEmail}`);

        // Check if user exists (case-insensitive)
        let user = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } });
        if (user) {
            console.log(`User found: ${JSON.stringify(user, null, 2)}`);
            // Validate user document
            if (!user._id || !user.email) {
                console.error(`Invalid user document for email ${normalizedEmail}: ${JSON.stringify(user)}`);
                return res.status(500).json({ message: 'Invalid user data in database' });
            }
            // Ensure user has a role
            if (!user.role) {
                console.warn(`User ${normalizedEmail} found but missing role field. Assigning default role 'user'.`);
                user.role = 'user';
                await user.save();
            }
            // Existing user, generate JWT token
            const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
            return res.status(200).json({ 
                token, 
                user: { id: user._id, email: user.email, role: user.role, phone_number: user.phone_number },
                message: "Logged in with email"
            });
        }

        console.log(`No user found for email: ${normalizedEmail}. Proceeding with new user registration.`);

        // New user, generate temporary token for phone number submission
        if (!name || !email) {
            return res.status(400).json({ message: 'Name and email are required' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const tempToken = jwt.sign({ name, email: normalizedEmail, firebaseIdToken: idToken }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ 
            tempToken, 
            message: "Requires phone number to complete registration"
        });
    } catch (error) {
        console.error('Email Signup Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/email-signup/complete', async (req, res) => {
    try {
        const { tempToken, phone_number } = req.body;

        // Verify temporary token
        let tempData;
        try {
            tempData = jwt.verify(tempToken, process.env.JWT_SECRET);
        } catch (err) {
            console.error(`Invalid or expired temporary token: ${err.message}`);
            return res.status(401).json({ message: 'Invalid or expired temporary token' });
        }

        const { name, email, firebaseIdToken } = tempData;

        // Re-verify Firebase ID token to ensure it's still valid
        const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
        if (decodedToken.email !== email) {
            console.error(`Email mismatch in /email-signup/complete: Firebase=${decodedToken.email}, Temp=${email}`);
            return res.status(400).json({ message: 'Email mismatch' });
        }

        // Validate phone number
        if (!/^\d{10}$/.test(phone_number)) {
            return res.status(400).json({ message: "Phone number must be 10 digits" });
        }

        // Check if phone number or email is already used
        const existingUser = await User.findOne({ $or: [
            { email: { $regex: new RegExp(`^${email}$`, 'i') } },
            { phone_number }
        ] });
        if (existingUser) {
            if (existingUser.email.toLowerCase() === email.toLowerCase()) {
                return res.status(400).json({ message: "User with this email already exists" });
            }
            if (existingUser.phone_number === phone_number) {
                return res.status(400).json({ message: "Phone number already in use" });
            }
        }

        // Generate user_id
        let count = await User.countDocuments();
        let user_id = `User_${String(count + 1).padStart(3, '0')}`;

        // Create new user with normalized email
        const user = new User({
            user_id,
            name,
            email: email.toLowerCase(),
            phone_number,
            password: null,
            role: 'user'
        });
        await user.save();

        // Generate JWT token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ 
            token, 
            user: { id: user._id, email: user.email, role: user.role, phone_number: user.phone_number },
            message: "User registered successfully with email"
        });
    } catch (error) {
        console.error('Email Signup Completion Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/email-login', async (req, res) => {
    try {
        const { idToken, email } = req.body;

        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (decodedToken.email !== email) {
            console.error(`Email mismatch: Firebase=${decodedToken.email}, Request=${email}`);
            return res.status(400).json({ message: 'Email mismatch' });
        }

        // Normalize email for query
        const normalizedEmail = email.toLowerCase();
        console.log(`Looking up user with email: ${normalizedEmail}`);

        // Check if user exists
        let user = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } });
        if (!user) {
            console.log(`No user found for email: ${normalizedEmail}`);
            return res.status(404).json({ message: 'User not found. Please sign up first.' });
        }

        console.log(`User found: ${JSON.stringify(user, null, 2)}`);

        // Validate user document
        if (!user._id || !user.email) {
            console.error(`Invalid user document for email ${normalizedEmail}: ${JSON.stringify(user)}`);
            return res.status(500).json({ message: 'Invalid user data in database' });
        }

        // Ensure user has a role
        if (!user.role) {
            console.warn(`User ${normalizedEmail} found but missing role field. Assigning default role 'user'.`);
            user.role = 'user';
            await user.save();
        }

        // Generate JWT token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({ 
            token, 
            user: { id: user._id, email: user.email, role: user.role, phone_number: user.phone_number },
            message: "Logged in with email"
        });
    } catch (error) {
        console.error('Email Login Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Verify user exists in Firebase
        try {
            await auth.getUserByEmail(email);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                return res.status(404).json({ message: 'No user found with this email' });
            }
            throw error;
        }

        // Send password reset email
        await auth.generatePasswordResetLink(email);
        res.status(200).json({ message: 'Password reset email sent successfully' });
    } catch (error) {
        console.error('Password Reset Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/google', async (req, res) => {
    try {
        const { idToken, name, email } = req.body;

        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (decodedToken.email !== email) {
            console.error(`Email mismatch: Firebase=${decodedToken.email}, Request=${email}`);
            return res.status(400).json({ message: 'Email mismatch' });
        }

        // Normalize email for query
        const normalizedEmail = email.toLowerCase();
        console.log(`Looking up user with email: ${normalizedEmail}`);

        // Check if user exists (case-insensitive)
        let user = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } });
        if (user) {
            console.log(`User found: ${JSON.stringify(user, null, 2)}`);
            // Validate user document
            if (!user._id || !user.email) {
                console.error(`Invalid user document for email ${normalizedEmail}: ${JSON.stringify(user)}`);
                return res.status(500).json({ message: 'Invalid user data in database' });
            }
            // Ensure user has a role
            if (!user.role) {
                console.warn(`User ${normalizedEmail} found but missing role field. Assigning default role 'user'.`);
                user.role = 'user';
                await user.save();
            }
            // Existing user, generate JWT token
            const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
            return res.status(200).json({ 
                token, 
                user: { id: user._id, email: user.email, role: user.role, phone_number: user.phone_number },
                message: "Logged in with Google"
            });
        }

        console.log(`No user found for email: ${normalizedEmail}. Proceeding with new user registration.`);

        // New user, generate temporary token for phone number submission
        if (!name || !email) {
            return res.status(400).json({ message: 'Name and email are required' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const tempToken = jwt.sign({ name, email: normalizedEmail, googleIdToken: idToken }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ 
            tempToken, 
            message: "Requires phone number to complete registration"
        });
    } catch (error) {
        console.error('Google Sign-In Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/google/complete', async (req, res) => {
    try {
        const { tempToken, phone_number } = req.body;

        // Verify temporary token
        let tempData;
        try {
            tempData = jwt.verify(tempToken, process.env.JWT_SECRET);
        } catch (err) {
            console.error(`Invalid or expired temporary token: ${err.message}`);
            return res.status(401).json({ message: 'Invalid or expired temporary token' });
        }

        const { name, email, googleIdToken } = tempData;

        // Re-verify Google ID token to ensure it's still valid
        const decodedToken = await admin.auth().verifyIdToken(googleIdToken);
        if (decodedToken.email !== email) {
            console.error(`Email mismatch in /google/complete: Firebase=${decodedToken.email}, Temp=${email}`);
            return res.status(400).json({ message: 'Email mismatch' });
        }

        // Validate phone number
        if (!/^\d{10}$/.test(phone_number)) {
            return res.status(400).json({ message: "Phone number must be 10 digits" });
        }

        // Check if phone number or email is already used
        const existingUser = await User.findOne({ $or: [
            { email: { $regex: new RegExp(`^${email}$`, 'i') } },
            { phone_number }
        ] });
        if (existingUser) {
            if (existingUser.email.toLowerCase() === email.toLowerCase()) {
                return res.status(400).json({ message: "User with this email already exists" });
            }
            if (existingUser.phone_number === phone_number) {
                return res.status(400).json({ message: "Phone number already in use" });
            }
        }

        // Generate user_id
        let count = await User.countDocuments();
        let user_id = `User_${String(count + 1).padStart(3, '0')}`;

        // Create new user with normalized email
        const user = new User({
            user_id,
            name,
            email: email.toLowerCase(),
            phone_number,
            password: null,
            role: 'user'
        });
        await user.save();

        // Generate JWT token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ 
            token, 
            user: { id: user._id, email: user.email, role: user.role, phone_number: user.phone_number },
            message: "User registered successfully with Google"
        });
    } catch (error) {
        console.error('Google Sign-In Completion Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/logout', (req, res) => {
    // Client-side will handle token removal
    res.json({ message: 'Logged out successfully' });
});

router.post('/signup-admin', async (req, res) => {
    try {
        const { name, phone_number, email, password, subscription_type } = req.body;

        // Check if the user already exists (case-insensitive)
        let existingUser = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists." });
        }

        // Generate a unique user_id
        let count = await User.countDocuments();
        let user_id = `User_${String(count + 1).padStart(3, '0')}`; // e.g., User_001, User_002, ...

        // Create a new admin user with normalized email
        const newUser = new User({
            user_id,
            name,
            phone_number,
            email: email.toLowerCase(),
            password,
            subscription_type: subscription_type || 'premium',
            role: 'admin'
        });

        // Save to database
        await newUser.save();

        // Generate JWT Token
        const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ message: "Admin user registered successfully!", token });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post('/refresh-token', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No token provided or invalid format');
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token received for refresh:', token);

    try {
        // Verify the token (ignore expiration for refresh purposes)
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
        console.log('Decoded token:', decoded);

        const user = await User.findById(decoded.id);
        if (!user) {
            console.log('User not found for token:', decoded.id);
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate a new token with fresh timestamps
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        const newToken = jwt.sign(
            { id: user._id, role: user.role, iat: currentTime },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        console.log('Refreshed token:', newToken);
        res.status(200).json({ token: newToken });
    } catch (err) {
        console.error('Token refresh failed:', err.message);
        res.status(401).json({ error: 'Invalid token: ' + err.message });
    }
});

module.exports = router;