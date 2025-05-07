const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Cafe = require('../models/Cafe');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Book = require('../models/Book'); // Added to fetch book data

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

// Middleware to check admin role
const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        console.log('User found in adminMiddleware:', user);
        next();
    } catch (err) {
        console.error('Error in adminMiddleware:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// Middleware to check cafe owner role
const cafeOwnerMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || user.role !== 'cafe') {
            return res.status(403).json({ error: 'Cafe owner access required' });
        }
        req.user = user;
        console.log('User found in cafeOwnerMiddleware:', user);
        next();
    } catch (err) {
        console.error('Error in cafeOwnerMiddleware:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/cafes - Retrieve list of cafes with case-insensitive filtering (public access)
router.get('/', async (req, res) => {
    try {
        const { location, average_bill, ratings, cafe_owner_id, name } = req.query;
        console.log('GET /api/cafes - Query:', req.query);
        let query = {};

        if (location) query.location = { $regex: location, $options: 'i' };
        if (average_bill) query.average_bill = Number(average_bill);
        if (ratings) query.ratings = Number(ratings);
        if (cafe_owner_id) query.cafe_owner_id = cafe_owner_id;
        if (name) query.name = { $regex: name, $options: 'i' }; // Add search by cafe name

        const cafes = await Cafe.find(query);
        console.log('Cafes fetched:', cafes);
        res.status(200).json(cafes);
    } catch (err) {
        console.error('Error fetching cafes:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/cafes/filters - Retrieve unique values for filters (public access)
router.get('/filters', async (req, res) => {
    try {
        const cities = await Cafe.distinct("city");
        const areas = await Cafe.distinct("area");
        const locations = await Cafe.distinct('location');
        const average_bills = await Cafe.distinct('average_bill');
        const ratings = await Cafe.distinct('ratings');

        res.status(200).json({ cities, areas, locations, average_bills, ratings });
    } catch (err) {
        console.error('Error fetching cafe filters:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/cafes/:cafe_id - Retrieve a specific cafe (public access)
router.get('/:cafe_id', async (req, res) => {
    try {
        const { cafe_id } = req.params;
        const cafe = await Cafe.findOne({ cafe_id });
        if (!cafe) {
            return res.status(404).json({ error: 'Cafe not found' });
        }
        res.status(200).json(cafe);
    } catch (err) {
        console.error('Error fetching cafe:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/cafes/book/:book_id - Retrieve cafes where a specific book is available
router.get('/book/:book_id', authMiddleware, async (req, res) => {
    try {
        const { book_id } = req.params;

        // Find the book to ensure it exists and get its keeper_id
        const book = await Book.findOne({ book_id });
        if (!book) {
            console.log(`Book not found: ${book_id}`);
            return res.status(404).json({ error: 'Book not found' });
        }
        if (!book.available) {
            console.log(`Book unavailable: ${book_id}`);
            return res.status(400).json({ error: 'Book is currently unavailable' });
        }

        // Find cafes where this book is available (keeper_id matches cafe_id)
        const cafes = await Cafe.find({ cafe_id: book.keeper_id });
        console.log(`Cafes fetched for book ${book_id}:`, cafes);

        if (cafes.length === 0) {
            return res.status(200).json([]); // Return empty array if no cafes found
        }

        res.status(200).json(cafes);
    } catch (err) {
        console.error(`Error fetching cafes for book ${req.params.book_id}:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/cafes/:cafe_id/transactions - Retrieve transactions for a specific cafe (cafe owner only)
router.get('/:cafe_id/transactions', authMiddleware, cafeOwnerMiddleware, async (req, res) => {
    try {
        const { cafe_id } = req.params;

        // Find the cafe by cafe_id (string) and get its ObjectId
        const cafe = await Cafe.findOne({ cafe_id });
        if (!cafe) {
            console.log(`Cafe not found: ${cafe_id}`);
            return res.status(404).json({ error: 'Cafe not found' });
        }

        // Verify that the authenticated user is the owner of this cafe
        if (cafe.cafe_owner_id && cafe.cafe_owner_id !== req.user.user_id) {
            console.log(`User ${req.user.user_id} is not the owner of cafe ${cafe_id}`);
            return res.status(403).json({ error: 'You are not authorized to view transactions for this cafe' });
        }

        // Fetch transactions for the cafe using the cafe's ObjectId
        const transactions = await Transaction.find({ cafe_id: cafe._id })
            .populate('book_id')
            .populate('user_id')
            .populate('cafe_id');

        console.log(`Transactions fetched for cafe ${cafe_id}:`, transactions);
        res.status(200).json(transactions);
    } catch (err) {
        console.error(`Error fetching transactions for cafe ${req.params.cafe_id}:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/cafes/:cafe_id/requests - Retrieve pending requests for a specific cafe (cafe owner only)
router.get('/:cafe_id/requests', authMiddleware, cafeOwnerMiddleware, async (req, res) => {
    try {
        const { cafe_id } = req.params;

        // Find the cafe by cafe_id (string) and get its ObjectId
        const cafe = await Cafe.findOne({ cafe_id });
        if (!cafe) {
            console.log(`Cafe not found: ${cafe_id}`);
            return res.status(404).json({ error: 'Cafe not found' });
        }

        // Verify that the authenticated user is the owner of this cafe
        if (cafe.cafe_owner_id && cafe.cafe_owner_id !== req.user.user_id) {
            console.log(`User ${req.user.user_id} is not the owner of cafe ${cafe_id}`);
            return res.status(403).json({ error: 'You are not authorized to view requests for this cafe' });
        }

        // Fetch transactions with status 'pickup_pending' or 'dropoff_pending'
        const requests = await Transaction.find({
            cafe_id: cafe._id, // Use the ObjectId instead of the string cafe_id
            status: { $in: ['pickup_pending', 'dropoff_pending'] },
        })
            .populate('book_id')
            .populate('user_id')
            .populate('cafe_id');

        console.log(`Requests fetched for cafe ${cafe_id}:`, requests);
        res.status(200).json(requests);
    } catch (err) {
        console.error(`Error fetching requests for cafe ${req.params.cafe_id}:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/cafes - Create a new cafe (admin-only)
router.post(
    '/',
    authMiddleware,
    adminMiddleware,
    [
        body('name')
            .notEmpty()
            .withMessage('Name is required')
            .trim(),
        body('location')
            .notEmpty()
            .withMessage('Location is required')
            .trim(),
        body('city')
            .optional()
            .trim(),
        body('area')
            .optional()
            .trim(),
        body('average_bill')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Average bill must be a positive number'),
        body('discount')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Discount must be a positive number'),
        body('ratings')
            .optional()
            .isFloat({ min: 0, max: 5 })
            .withMessage('Ratings must be between 0 and 5'),
        body('cafe_owner_id').optional().trim(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { name, location, city, area, average_bill, discount, ratings, specials, cafe_owner_id , image_url,gmap_url, audio_url,} = req.body;

            // Generate a unique cafe_id
            const cafeCount = await Cafe.countDocuments();
            const cafeIdNumber = cafeCount + 1;
            const cafe_id = `cafe_${String(cafeIdNumber).padStart(3, '0')}`; // e.g., cafe_001, cafe_002, etc.

            if (cafe_owner_id) {
                const owner = await User.findOne({ user_id: cafe_owner_id, role: 'cafe' });
                if (!owner) {
                    return res.status(400).json({ error: 'Invalid cafe_owner_id or user is not a cafe owner' });
                }
            }

            const cafe = new Cafe({
                cafe_id, // Add the generated cafe_id
                name,
                location,
                city,
                area,
                image_url,
                gmap_url,
                audio_url,
                average_bill: average_bill || 0,
                discount: discount || 0,
                ratings: ratings || 0,
                specials,
                cafe_owner_id: cafe_owner_id || null,
            });

            await cafe.save();
            console.log('Cafe created:', cafe);
            res.status(201).json({ message: 'Cafe created successfully', cafe });
        } catch (err) {
            console.error('Error creating cafe:', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// PUT /api/cafes/:cafe_id - Update a cafe (admin or cafe owner)
router.put(
    '/:cafe_id',
    authMiddleware,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { cafe_id } = req.params;
            const updates = req.body;

            const cafe = await Cafe.findOne({ cafe_id });
            if (!cafe) {
                return res.status(404).json({ error: 'Cafe not found' });
            }

            // Check if the user is an admin or the cafe owner
            const user = await User.findById(req.userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (user.role !== 'admin' && (user.role !== 'cafe' || cafe.cafe_owner_id !== user.user_id)) {
                return res.status(403).json({ error: 'Access denied. You are not authorized to update this cafe.' });
            }

            if (updates.cafe_owner_id) {
                const owner = await User.findOne({ user_id: updates.cafe_owner_id, role: 'cafe' });
                if (!owner) {
                    return res.status(400).json({ error: 'Invalid cafe_owner_id or user is not a cafe owner' });
                }
            }

            Object.assign(cafe, updates);
            cafe.updatedAt = Date.now();
            await cafe.save();

            console.log('Cafe updated:', cafe);
            res.status(200).json({ message: 'Cafe updated successfully', cafe });
        } catch (err) {
            console.error('Error updating cafe:', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// DELETE /api/cafes/:cafe_id - Delete a cafe (admin-only)
router.delete('/:cafe_id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { cafe_id } = req.params;
        const cafe = await Cafe.findOne({ cafe_id });
        if (!cafe) {
            return res.status(404).json({ error: 'Cafe not found' });
        }

        await cafe.deleteOne();
        console.log('Cafe deleted:', cafe);
        res.status(200).json({ message: 'Cafe deleted successfully' });
    } catch (err) {
        console.error('Error deleting cafe:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;