const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
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
const importRoutes = require('./routes/import'); // Add this line

const cookieParser = require('cookie-parser');

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory');
}

dotenv.config({ path: path.resolve(__dirname, './.env') });

// Debug: Log all environment variables to verify they are loaded
console.log('--- Environment Variables Loaded ---');
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? 'Loaded' : 'MISSING');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'MISSING');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Loaded' : 'MISSING');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? process.env.EMAIL_USER : 'MISSING');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Loaded' : 'MISSING');
console.log('------------------------------------');

// Validate critical environment variables
if (!process.env.JWT_SECRET || !process.env.MONGODB_URI || !process.env.RAZORPAY_KEY_ID || !process.env.EMAIL_USER) {
    console.error('FATAL ERROR: One or more critical environment variables are not defined. Please check your .env file.');
    process.exit(1);
}

const app = express();

app.use(cookieParser());

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

const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after a minute',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 50,
    message: 'Too many authentication attempts from this IP, please try again after a minute',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', generalLimiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
})
    .then(async () => {
        console.log('MongoDB connected');

        // Register routes
        app.use('/api/auth', authLimiter, authRoutes); 
        app.use('/api/users', userRoutes);
        app.use('/api/transactions', transactionRoutes);
        app.use('/api/books', bookRoutes);
        app.use('/api/cafes', cafeRoutes);
        app.use('/api/cafe', cafePortalRoutes);
        app.use('/api/client', clientPortalRoutes);
        app.use('/api/admin', adminPortalRoutes);
        app.use('/api/import', importRoutes); // Add import routes

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