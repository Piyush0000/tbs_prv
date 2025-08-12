const rateLimit = require('express-rate-limit');

// General rate limiter (100 requests per minute)
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per minute
    message: 'Too many requests from this IP, please try again after a minute',
    standardHeaders: true, 
    legacyHeaders: false,
});

// Stricter rate limiter for auth routes (50 requests per minute)
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // Limit each IP to 50 auth-related requests per minute
    message: 'Too many authentication attempts from this IP, please try again after a minute',
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    generalLimiter,
    authLimiter,
};