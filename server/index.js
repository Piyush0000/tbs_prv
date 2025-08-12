const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const logger = require('./utils/logger');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transactions');
const bookRoutes = require('./routes/books');
const cafeRoutes = require('./routes/cafes');
const cafePortalRoutes = require('./routes/cafePortal');
const clientPortalRoutes = require('./routes/clientPortal');
const adminPortalRoutes = require('./routes/adminPortal');

// Load environment variables from .env file
require('dotenv').config();

// Debug: Log environment variables to verify they are loaded
console.log('Environment Variables:');
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID);
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET);
console.log('RAZORPAY_WEBHOOK_SECRET:', process.env.RAZORPAY_WEBHOOK_SECRET);
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Validate critical environment variables
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables');
    process.exit(1);
}
if (!process.env.MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined in environment variables');
    process.exit(1);
}
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error('FATAL ERROR: Razorpay credentials are not fully defined in environment variables');
    process.exit(1);
}

// REMOVED: The check for FIREBASE_SERVICE_ACCOUNT_KEY has been removed.

const app = express();

// Configure CORS
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? 'https://your-frontend-domain.com'
        : 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};
app.use(cors(corsOptions));

// Parse JSON request bodies
app.use(express.json());

// Log all incoming requests with body
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - IP: ${req.ip} - Body: ${JSON.stringify(req.body)}`);
    next();
});

// CHANGED: Updated rate limiting to match your request.
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per minute
    message: 'Too many requests from this IP, please try again after a minute',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // Limit each IP to 50 requests per minute for auth routes
    message: 'Too many authentication attempts from this IP, please try again after a minute',
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply the general rate limiter to all API routes
app.use('/api/', generalLimiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
})
    .then(async () => {
        console.log('MongoDB connected');

        // Register routes after MongoDB connection is confirmed
        // The stricter authLimiter will apply only to the /api/auth route
        app.use('/api/auth', authLimiter, authRoutes); 
        app.use('/api/users', userRoutes);
        app.use('/api/transactions', transactionRoutes);
        app.use('/api/books', bookRoutes);
        app.use('/api/cafes', cafeRoutes);
        app.use('/api/cafe', cafePortalRoutes);
        app.use('/api/client', clientPortalRoutes);
        app.use('/api/admin', adminPortalRoutes);

        // Global error handler
        app.use((err, req, res, next) => {
            logger.error(`Error: ${err.message} - Stack: ${err.stack}`);
            res.status(500).json({ error: 'Something went wrong, please try again later' });
        });

        // Start server
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });