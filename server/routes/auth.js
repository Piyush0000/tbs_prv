const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// Assuming rateLimiter.js is in a 'utils' folder as discussed
const { authLimiter } = require('../utils/rateLimiter'); 

// Apply the stricter rate limiter to all routes in this file
router.use(authLimiter);

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user with email and password
 * @access  Public
 */
router.post('/signup', async (req, res) => {
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
        // Check if the user already exists
        let existingUser = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists." });
        }

        // Generate a unique user_id
        let count = await User.countDocuments();
        let user_id = `User_${String(count + 1).padStart(3, '0')}`;

        const newUser = new User({
            user_id,
            name,
            phone_number,
            email: email.toLowerCase(),
            password, // The password will be hashed by the pre-save hook in the User model
            role: 'user'
        });

        await newUser.save();

        const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ message: "User registered successfully!", token });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login a user with email and password
 * @access  Public
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        // Compare password with hashed password in DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({ token, user: { id: user._id, email: user.email, role: user.role } });
    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logs out a user
 * @access  Private (Client-side implementation)
 */
router.post('/logout', (req, res) => {
    // The client is responsible for deleting the JWT.
    res.json({ message: 'Logged out successfully' });
});

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refreshes an expired JWT
 * @access  Private
 */
router.post('/refresh-token', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify the token, allowing for expired tokens for refresh purposes
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Issue a new token with a new expiration date
        const newToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.status(200).json({ token: newToken });
    } catch (err) {
        console.error('Token refresh failed:', err.message);
        res.status(401).json({ error: 'Invalid token: ' + err.message });
    }
});

module.exports = router;