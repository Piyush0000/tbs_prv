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
const importRoutes = require('./routes/import');
const cookieParser = require('cookie-parser');
const fs = require('fs');

// Load environment variables FIRST
dotenv.config({ path: path.resolve(__dirname, './.env') });

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ Created uploads directory');
}

// Log environment variables (for debugging)
console.log('=== Environment Variables ===');
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? '✅ Loaded' : '❌ MISSING');
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? '✅ Loaded' : '❌ MISSING');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Loaded' : '❌ MISSING');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Loaded' : '❌ MISSING');
console.log('EMAIL_USER:', process.env.EMAIL_USER || '❌ MISSING');
console.log('PORT:', process.env.PORT || 8080);
console.log('============================');

// CRITICAL FIX: Warn about missing env vars but DON'T exit
// Let the server start so Cloud Run health checks pass
const missingVars = [];
if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET');
if (!process.env.MONGODB_URI) missingVars.push('MONGODB_URI');
if (!process.env.RAZORPAY_KEY_ID) missingVars.push('RAZORPAY_KEY_ID');
if (!process.env.RAZORPAY_KEY_SECRET) missingVars.push('RAZORPAY_KEY_SECRET');

if (missingVars.length > 0) {
    console.error('⚠️  WARNING: Missing environment variables:', missingVars.join(', '));
    console.error('⚠️  Some features may not work correctly!');
    // DON'T exit - let server start for health checks
}

const app = express();

// Configure proxy trust
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
} else {
    app.set('trust proxy', true);
}

app.use(cookieParser());

// CORS configuration
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

app.use(cors(corsOptions));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

// Rate limiting
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

// IMPROVED: Database connection middleware with better error handling
const checkDatabaseConnection = (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        console.error('⚠️  Database not connected. ReadyState:', mongoose.connection.readyState);
        return res.status(503).json({ 
            error: 'Database connection unavailable. Please try again later.',
            code: 'DB_CONNECTION_ERROR',
            status: 'connecting'
        });
    }
    next();
};

// CRITICAL FIX: Health check endpoint FIRST (before any DB checks)
// This allows Cloud Run to verify the server is running
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 
                     mongoose.connection.readyState === 2 ? 'connecting' : 'disconnected';
    
    // Return 200 OK even if DB is connecting (server is alive)
    res.status(200).json({ 
        status: 'OK',
        server: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus,
        dbReadyState: mongoose.connection.readyState,
        trustProxy: app.get('trust proxy'),
        clientIP: req.ip,
    });
});

// Readiness check (for Cloud Run to know when to send traffic)
app.get('/ready', (req, res) => {
    if (mongoose.connection.readyState === 1) {
        res.status(200).json({ status: 'ready', database: 'connected' });
    } else {
        res.status(503).json({ status: 'not ready', database: 'connecting' });
    }
});

// Register routes
app.use('/api/auth', authLimiter, authRoutes); 
app.use('/api/users', checkDatabaseConnection, userRoutes);
app.use('/api/transactions', checkDatabaseConnection, transactionRoutes);
app.use('/api/books', checkDatabaseConnection, bookRoutes);
app.use('/api/cafes', checkDatabaseConnection, cafeRoutes);
app.use('/api/cafe', checkDatabaseConnection, cafePortalRoutes);
app.use('/api/client', checkDatabaseConnection, clientPortalRoutes);
app.use('/api/admin', checkDatabaseConnection, adminPortalRoutes);
app.use('/api/import', checkDatabaseConnection, importRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message} - Stack: ${err.stack}`);
    
    if (err.name === 'MongooseError' || err.name === 'MongoError') {
        return res.status(503).json({ 
            error: 'Database error. Please try again later.',
            code: 'DATABASE_ERROR'
        });
    }
    
    res.status(500).json({ error: 'Something went wrong, please try again later' });
});

// IMPROVED MongoDB Connection
const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI not set - skipping database connection');
        return;
    }

    try {
        console.log('🔄 Attempting to connect to MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI, {
            connectTimeoutMS: 10000,      // Reduced from 30s
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 0,
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            retryWrites: true,
            retryReads: true,
            family: 4,
        });
        
        console.log('✅ MongoDB connected successfully');
        startKeepAlive();
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.log('⏳ Will retry connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

// Keep-alive mechanism
let keepAliveInterval;

const startKeepAlive = () => {
    if (keepAliveInterval) return; // Prevent multiple intervals
    
    keepAliveInterval = setInterval(async () => {
        try {
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.db.admin().ping();
                console.log('📡 Database ping successful');
            }
        } catch (error) {
            console.error('❌ Database ping failed:', error.message);
        }
    }, 30000);

    console.log('✅ Keep-alive mechanism started');
};

const stopKeepAlive = () => {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        console.log('⏹️  Keep-alive mechanism stopped');
    }
};

// MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️  Mongoose disconnected from MongoDB');
    setTimeout(() => {
        if (mongoose.connection.readyState === 0) {
            console.log('🔄 Attempting to reconnect...');
            connectDB();
        }
    }, 5000);
});

mongoose.connection.on('reconnected', () => {
    console.log('🔄 Mongoose reconnected to MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('⏹️  Shutting down gracefully...');
    try {
        stopKeepAlive();
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('⏹️  SIGTERM received, shutting down gracefully...');
    try {
        stopKeepAlive();
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
    }
});

// CRITICAL FIX: Start server IMMEDIATELY (don't wait for DB)
const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 Proxy trust: ${app.get('trust proxy')}`);
    console.log(`🔗 CORS enabled for: ${allowedOrigins.join(', ')}`);
    console.log('========================================');
    
    // Start DB connection AFTER server is listening
    connectDB();
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
    } else {
        console.error('❌ Server error:', error);
    }
    process.exit(1);
});

// Ensure server stays alive
server.keepAliveTimeout = 65000; // Longer than Cloud Run's 60s timeout
server.headersTimeout = 66000;

module.exports = app;
