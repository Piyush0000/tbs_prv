const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
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
const importRoutes = require('./routes/import');
// const paymentRoutes = require('./routes/payments');
// const webhookRoutes = require('./routes/webhooks');
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
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'Loaded' : 'MISSING');
console.log('RAZORPAY_WEBHOOK_SECRET:', process.env.RAZORPAY_WEBHOOK_SECRET ? 'Loaded' : 'MISSING');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'MISSING');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Loaded' : 'MISSING');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? process.env.EMAIL_USER : 'MISSING');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Loaded' : 'MISSING');
console.log('------------------------------------');

// Validate critical environment variables
if (!process.env.JWT_SECRET || !process.env.MONGODB_URI || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.EMAIL_USER) {
    console.error('FATAL ERROR: One or more critical environment variables are not defined. Please check your .env file.');
    process.exit(1);
}




const app = express();

// IMPORTANT: Configure proxy trust BEFORE rate limiting
// This fixes the X-Forwarded-For header validation error
if (process.env.NODE_ENV === 'production') {
    // In production, trust the first proxy (common for most deployment scenarios)
    app.set('trust proxy', 1);
} else {
    // In development, you might want to trust all proxies or set specific IPs
    // For local development with reverse proxy testing:
    app.set('trust proxy', true);
}

app.use(cookieParser());

// IMPORTANT: Webhook routes with raw body parser MUST come BEFORE express.json()
// app.use('/api/webhooks/razorpay', express.raw({type: 'application/json'}), webhookRoutes);

// FIXED: Configure CORS for localhost development
const allowedOrigins = [
  'http://localhost:3000',
  'https://www.thebookshelves.com',
    'https://tbs-prv-iota.vercel.app',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed for this origin: " + origin));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};



console.log('CORS configured for origin:', corsOptions.origin);
app.use(cors(corsOptions));

// Parse JSON request bodies (comes AFTER webhook raw parser)
app.use(express.json());

// Log all incoming requests with body
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - IP: ${req.ip} - Body: ${JSON.stringify(req.body)}`);
    next();
});

// Rate limiting configuration with improved settings
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after a minute',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Optional: Skip successful requests (only count failed requests)
    skipSuccessfulRequests: false,
    // Optional: Skip failed requests (only count successful requests)
    skipFailedRequests: false,
});

const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // limit each IP to 50 auth requests per windowMs
    message: 'Too many authentication attempts from this IP, please try again after a minute',
    standardHeaders: true,
    legacyHeaders: false,
    // More strict for auth endpoints
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
});

// Apply general rate limiting to all API routes
app.use('/api/', generalLimiter);

// Database connection middleware
const checkDatabaseConnection = (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        console.error('Database not connected. ReadyState:', mongoose.connection.readyState);
        return res.status(503).json({ 
            error: 'Database connection unavailable. Please try again later.',
            code: 'DB_CONNECTION_ERROR'
        });
    }
    next();
};

// REGISTER ROUTES IMMEDIATELY (NOT inside MongoDB callback)
app.use('/api/auth', authLimiter, authRoutes); 
app.use('/api/users', checkDatabaseConnection, userRoutes);
app.use('/api/transactions', checkDatabaseConnection, transactionRoutes);
app.use('/api/books', checkDatabaseConnection, bookRoutes);
app.use('/api/cafes', checkDatabaseConnection, cafeRoutes);
app.use('/api/cafe', checkDatabaseConnection, cafePortalRoutes);
app.use('/api/client', checkDatabaseConnection, clientPortalRoutes);
app.use('/api/admin', checkDatabaseConnection, adminPortalRoutes);
app.use('/api/import', checkDatabaseConnection, importRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus,
        // Include proxy info for debugging
        trustProxy: app.get('trust proxy'),
        clientIP: req.ip,
        forwardedFor: req.get('X-Forwarded-For')
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message} - Stack: ${err.stack}`);
    
    // Handle specific database errors
    if (err.name === 'MongooseError' || err.name === 'MongoError') {
        return res.status(503).json({ 
            error: 'Database error. Please try again later.',
            code: 'DATABASE_ERROR'
        });
    }
    
    res.status(500).json({ error: 'Something went wrong, please try again later' });
});

// IMPROVED MongoDB Connection with automatic reconnection and keep-alive
const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI, {
            // Connection timeout settings
            connectTimeoutMS: 30000,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 0, // Disable socket timeout
            
            // Connection pool settings
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            
            // Retry and resilience settings
            retryWrites: true,
            retryReads: true,
            
            // Use IPv4
            family: 4,
        });
        
        console.log('✅ MongoDB connected successfully');
        
        // Start keep-alive mechanism
        startKeepAlive();
        
        // // Initialize coupon codes only once when first connected
        // if (!global.couponsInitialized) {
        //     try {
        //         const initCoupons = require('./initCoupons');
        //         await initCoupons();
        //         console.log('✅ Coupon codes initialized');
        //         global.couponsInitialized = true;
        //     } catch (error) {
        //         console.error('❌ Error initializing coupons:', error.message);
        //     }
        // }
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.log('⏳ Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

// Keep-alive mechanism to prevent idle disconnections
let keepAliveInterval;

const startKeepAlive = () => {
    keepAliveInterval = setInterval(async () => {
        try {
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.db.admin().ping();
                console.log('📡 Database ping successful');
            }
        } catch (error) {
            console.error('❌ Database ping failed:', error.message);
        }
    }, 30000); // 30 seconds

    console.log('✅ Keep-alive mechanism started');
};

const stopKeepAlive = () => {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        console.log('⏹️ Keep-alive mechanism stopped');
    }
};

// Handle MongoDB connection events with automatic reconnection
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose disconnected from MongoDB');
    console.log('🔄 Attempting to reconnect...');
    
    // Don't spam reconnections - add a delay
    setTimeout(() => {
        if (mongoose.connection.readyState === 0) {
            connectDB();
        }
    }, 5000);
});

mongoose.connection.on('reconnected', () => {
    console.log('🔄 Mongoose reconnected to MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    try {
        stopKeepAlive();
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Start the connection process
connectDB();

// Start server immediately (don't wait for DB connection)
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 Proxy trust setting: ${app.get('trust proxy')}`);
    console.log('💳 Payment system initialized with Razorpay integration');
    console.log(`🔗 CORS enabled for: ${Array.isArray(corsOptions.origin) ? corsOptions.origin.join(', ') : corsOptions.origin}`);
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error);
});

module.exports = app;
