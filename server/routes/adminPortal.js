const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Book = require('../models/Book');
const User = require('../models/User');
const Cafe = require('../models/Cafe');
const Transaction = require('../models/Transaction');

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log('Received token:', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No token provided or invalid format');
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);
        req.userId = decoded.id;
        next();
    } catch (err) {
        console.error('Token verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Middleware to check admin role
const adminMiddleware = async (req, res, next) => {
    try {
        console.log('User ID from token:', req.userId);
        const user = await User.findById(req.userId);
        console.log('User found in adminMiddleware:', user);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (err) {
        console.error('Admin middleware error:', err.message);
        return res.status(500).json({ error: 'Server error in admin middleware' });
    }
};

// GET /api/admin/inventory - Retrieve detailed book inventory in CSV format
router.get('/inventory', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const books = await Book.find();
        console.log('Books fetched:', books);
        
        // Format data to match CSV structure exactly (CSV uses 'id' for book_id)
        const inventory = books.map(book => ({
            id: book.book_id || book.id,
            is_free: book.is_free,
            name: book.name,
            author: book.author,
            language: book.language,
            publisher: book.publisher,
            genre: book.genre,
            image_url: book.image_url,
            ratings: book.ratings,
            available: book.available,
            keeper_id: book.keeper_id || ''
        }));

        return res.status(200).json(inventory);
    } catch (err) {
        console.error('Error fetching inventory:', err.message);
        return res.status(500).json({ error: 'Failed to fetch book inventory' });
    }
});

// GET /api/admin/inventory/csv - Export inventory as CSV format
router.get('/inventory/csv', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const books = await Book.find();
        console.log('Books fetched for CSV export:', books);
        
        // Create CSV headers matching the Excel format
        const headers = 'id,is_free,name,author,language,publisher,genre,image_url,ratings,available,keeper_id\n';
        
        // Format each book as CSV row (CSV uses 'id' for book_id)
        const csvRows = books.map(book => {
            return [
                book.book_id || book.id || '',
                book.is_free || 'FALSE',
                book.name || '',
                book.author || '',
                book.language || '',
                book.publisher || '',
                book.genre || '',
                book.image_url || '',
                book.ratings || '0',
                book.available ? 'TRUE' : 'FALSE',
                book.keeper_id || ''
            ].join(',');
        }).join('\n');
        
        const csvContent = headers + csvRows;
        
        // Set CSV response headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="books_inventory.csv"');
        
        return res.status(200).send(csvContent);
    } catch (err) {
        console.error('Error exporting CSV:', err.message);
        return res.status(500).json({ error: 'Failed to export CSV' });
    }
});

// Function to generate book_id in the format <Initials>_<Number>
const generateBookId = async (bookName) => {
    try {
        // Step 1: Extract initials from the book name
        const words = bookName.trim().split(/\s+/);
        const initials = words
            .map(word => word.charAt(0).toUpperCase())
            .join('');

        // Step 2: Count existing books with the same initials (both old and new formats)
        const regexNewFormat = new RegExp(`^${initials}_\\d+$`);
        const regexOldFormat = new RegExp(`^${initials}\\d+$`);
        const countNewFormat = await Book.countDocuments({ book_id: regexNewFormat });
        const countOldFormat = await Book.countDocuments({ book_id: regexOldFormat });

        // Step 3: Generate the next number (total count + 1)
        const totalCount = countNewFormat + countOldFormat;
        const nextNumber = totalCount + 1;

        // Step 4: Generate the book_id with an underscore
        const bookId = `${initials}_${nextNumber}`;

        return bookId;
    } catch (error) {
        console.error('Error generating book_id:', error);
        return null;
    }
};

// POST /api/admin/books - Manually add a new book (admin-only) with CSV format compatibility
router.post(
    '/books',
    authMiddleware,
    adminMiddleware,
    [
        body('name')
            .notEmpty()
            .withMessage('name is required')
            .trim(),
        body('author').notEmpty().withMessage('author is required').trim(),
        body('language').notEmpty().withMessage('language is required').trim(),
        body('ratings').optional().isInt({ min: 0, max: 5 }).withMessage('ratings must be between 0 and 5'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const {
                name,
                author,
                language,
                publisher,
                genre,
                image_url,
                ratings,
                is_free,
                available,
                keeper_id,
            } = req.body;

            console.log('Received book data:', req.body);

            // Validate required fields
            if (!name || !author || !language) {
                return res.status(400).json({ error: 'Name, author, and language are required fields' });
            }

            // Generate the book_id before creating the book
            const bookId = await generateBookId(name);
            console.log('Generated book_id:', bookId);

            // Ensure book_id is not empty
            if (!bookId) {
                return res.status(500).json({ error: 'Failed to generate book_id' });
            }

            const bookData = {
                book_id: bookId,
                name: name.trim(),
                author: author.trim(),
                language: language.trim(),
                publisher: publisher ? publisher.trim() : '',
                genre: genre ? genre.trim() : '',
                image_url: image_url ? image_url.trim() : '',
                audio_url: '',
                pdf_url: '',
                description: '',
                ratings: parseInt(ratings) || 0,
                is_free: Boolean(is_free),
                available: available !== undefined ? Boolean(available) : true,
                keeper_id: keeper_id ? keeper_id.trim() : '',
            };

            console.log('Book data to save:', bookData);

            const book = new Book(bookData);
            await book.save();
            console.log('Book saved successfully:', book);
            
            // Return response in CSV-compatible format (using 'id' instead of 'book_id')
            const response = {
                message: 'Book added successfully',
                book: {
                    id: book.book_id,
                    is_free: book.is_free,
                    name: book.name,
                    author: book.author,
                    language: book.language,
                    publisher: book.publisher,
                    genre: book.genre,
                    image_url: book.image_url,
                    ratings: book.ratings,
                    available: book.available,
                    keeper_id: book.keeper_id
                }
            };
            
            return res.status(201).json(response);
        } catch (err) {
            console.error('Error adding book:', err.message);
            console.error('Full error:', err);
            return res.status(500).json({ error: 'Failed to add book: ' + err.message });
        }
    }
);
module.exports = router;
// PUT /api/admin/books/:book_id - Update book details