// middleware/database.js
const mongoose = require('mongoose');

/**
 * Middleware to check database connection before processing requests
 * This prevents the "Client must be connected" error
 */
const checkDatabaseConnection = (req, res, next) => {
    const dbState = mongoose.connection.readyState;
    
    // MongoDB connection states:
    // 0 = disconnected
    // 1 = connected
    // 2 = connecting
    // 3 = disconnecting
    
    if (dbState !== 1) {
        console.error(`Database connection check failed. State: ${dbState} (${getStateDescription(dbState)})`);
        
        return res.status(503).json({ 
            error: 'Database temporarily unavailable. Please try again in a moment.',
            code: 'DB_CONNECTION_ERROR',
            state: getStateDescription(dbState)
        });
    }
    
    next();
};

/**
 * Get human-readable description of connection state
 */
const getStateDescription = (state) => {
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    return states[state] || 'unknown';
};

/**
 * Wrapper for async route handlers to catch database errors
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            console.error('Async handler caught error:', error);
            
            // Handle specific MongoDB/Mongoose errors
            if (error.name === 'MongooseError' || error.name === 'MongoError') {
                return res.status(503).json({ 
                    error: 'Database error. Please try again later.',
                    code: 'DATABASE_ERROR'
                });
            }
            
            // Handle validation errors
            if (error.name === 'ValidationError') {
                return res.status(400).json({ 
                    error: 'Validation error',
                    details: error.message,
                    code: 'VALIDATION_ERROR'
                });
            }
            
            // Handle duplicate key errors
            if (error.code === 11000) {
                return res.status(409).json({ 
                    error: 'Duplicate entry found',
                    code: 'DUPLICATE_ERROR'
                });
            }
            
            // Generic error
            next(error);
        });
    };
};

/**
 * Health check function for database
 */
const getDatabaseHealth = () => {
    const state = mongoose.connection.readyState;
    return {
        connected: state === 1,
        state: getStateDescription(state),
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        collections: Object.keys(mongoose.connection.collections).length
    };
};

module.exports = {
    checkDatabaseConnection,
    asyncHandler,
    getDatabaseHealth,
    getStateDescription
};