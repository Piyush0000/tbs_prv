const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Cafe = require('../models/Cafe');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log('Authorization header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No token provided or invalid format');
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token extracted:', token);

    // Check if JWT_SECRET is defined
    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables');
        return res.status(500).json({ error: 'Internal server error: JWT_SECRET not configured' });
    }
    console.log('JWT_SECRET used for verification:', process.env.JWT_SECRET);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded:', decoded);
        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    } catch (err) {
        console.error('Token verification failed:', err.message);
        res.status(401).json({ error: `Invalid token: ${err.message}` });
    }
};

// Middleware to check cafe owner role and ownership
const cafeOwnerMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            console.log('User not found for userId:', req.userId);
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.role !== 'cafe' && user.role !== 'admin') {
            console.log('User role is not cafe or admin:', user.role);
            return res.status(403).json({ error: 'Cafe owner or admin access required' });
        }

        const { cafe_id } = req.params;
        console.log('Checking ownership for cafe_id:', cafe_id);

        // Fetch the cafe to get its cafe_owner_id
        const cafe = await Cafe.findOne({ cafe_id });
        if (!cafe) {
            console.log('Cafe not found for cafe_id:', cafe_id);
            return res.status(404).json({ error: 'Cafe not found' });
        }

        // If the user is a cafe owner (not an admin), check if they own this cafe
        if (user.role === 'cafe' && user.user_id !== cafe.cafe_owner_id) {
            console.log('User is not the owner of cafe:', { user_id: user.user_id, cafe_owner_id: cafe.cafe_owner_id, cafe_id });
            return res.status(403).json({ error: 'You can only access your own cafe' });
        }

        console.log('User passed cafeOwnerMiddleware:', user);
        req.cafe = cafe; // Attach the cafe to the request for use in the route handler
        next();
    } catch (err) {
        console.error('Error in cafeOwnerMiddleware:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/cafe/:cafe_id/requests - Retrieve pending transactions for the cafe
router.get('/:cafe_id/requests', authMiddleware, cafeOwnerMiddleware, async (req, res) => {
    try {
        const { cafe_id } = req.params;
        console.log('Fetching transactions for cafe_id:', cafe_id);

        // Cafe already fetched in cafeOwnerMiddleware, available as req.cafe
        const cafe = req.cafe;

        // Find pending transactions (pickup_pending or dropoff_pending) using the cafe's ObjectId
        const transactions = await Transaction.find({
            cafe_id: cafe._id, // Use the ObjectId instead of the string cafe_id
            status: { $in: ['pickup_pending', 'dropoff_pending'] },
        }).populate('book_id user_id');

        console.log('Fetched transactions:', transactions);
        res.status(200).json(transactions);
    } catch (err) {
        console.error('Error fetching transactions:', err.message);
        res.status(500).json({ error: 'Failed to fetch transactions: ' + err.message });
    }
});

// GET /api/cafe/:cafe_id/discounts - Retrieve discount benefits for the cafe
router.get('/:cafe_id/discounts', authMiddleware, cafeOwnerMiddleware, async (req, res) => {
    try {
        const { cafe_id } = req.params;
        console.log('Fetching discount benefits for cafe_id:', cafe_id);

        // Cafe already fetched in cafeOwnerMiddleware, available as req.cafe
        const cafe = req.cafe;

        // Return the discount benefits (could be expanded based on subscription tiers)
        const discountBenefits = {
            cafe_id: cafe.cafe_id,
            name: cafe.name,
            discount: cafe.discount,
            message: `This cafe offers a ${cafe.discount} discount based on user subscription tier.`,
        };

        console.log('Discount benefits fetched:', discountBenefits);
        res.status(200).json(discountBenefits);
    } catch (err) {
        console.error('Error fetching discount benefits:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;