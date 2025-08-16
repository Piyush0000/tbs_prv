const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Book = require('../models/Book');
const User = require('../models/User'); // Still needed for admin check

// ===================================================================================
// MIDDLEWARE (Assuming these are now in a central /middleware folder)
// ===================================================================================

// Note: For this example, the middleware is included here. 
// In your project, you should move these to a separate file (e.g., /middleware/auth.js) and import them.
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error while verifying admin role' });
  }
};


// ===================================================================================
// VALIDATION RULES
// ===================================================================================

const bookValidationRules = [
    body('name').notEmpty().withMessage('Name is required').trim(),
    body('author').notEmpty().withMessage('Author is required').trim(),
    body('language').notEmpty().withMessage('Language is required').trim(),
    body('ratings').optional().isInt({ min: 0, max: 5 }).withMessage('Ratings must be an integer between 0 and 5'),
];


// ===================================================================================
// CONTROLLER FUNCTIONS
// ===================================================================================

/**
 * Controller to get a list of all books with optional filters.
 */
const getAllBooks = async (req, res) => {
  try {
    const { genre, author, language, name, available } = req.query; // Simplified filters from original
    let query = {};

    if (genre) query.genre = { $regex: genre, $options: 'i' };
    if (author) query.author = { $regex: author, $options: 'i' };
    if (language) query.language = { $regex: language, $options: 'i' };
    if (name) query.name = { $regex: name, $options: 'i' };
    if (available) query.available = available === 'true';

    const books = await Book.find(query);
    res.status(200).json(books);
  } catch (err) {
    console.error('Error fetching books:', err.message);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
};

/**
 * Controller to get unique values for filter dropdowns.
 */
const getBookFilters = async (req, res) => {
  try {
    const authors = await Book.distinct('author');
    const genres = await Book.distinct('genre');
    const languages = await Book.distinct('language');
    res.status(200).json({ authors, genres, languages });
  } catch (err) {
    console.error('Error fetching filters:', err.message);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
};

/**
 * Controller to get a single book by its public book_id.
 */
const getBookById = async (req, res) => {
  try {
    const { book_id } = req.params;
    const book = await Book.findOne({ book_id });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.status(200).json(book);
  } catch (err) {
    console.error(`Error fetching book ${req.params.book_id}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
};

/**
 * [NEW] Controller for the QR Scanner workflow to look up a book by its ID.
 */
const getBookDetailsForScanner = async (req, res) => {
    try {
        const { bookId } = req.params;
        const book = await Book.findOne({ book_id: bookId });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.status(200).json(book);
    } catch (error) {
        console.error(`Error fetching book details for scanner: ${error.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Controller to create a new book. Admin only.
 */
const createBook = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const newBook = new Book(req.body);
      await newBook.save();
      res.status(201).json({ message: 'Book created successfully', book: newBook });
    } catch (err) {
      console.error('Error creating book:', err.message);
      res.status(500).json({ error: 'Failed to create book' });
    }
};

/**
 * Controller to update an existing book. Admin only.
 */
const updateBook = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { book_id } = req.params;
      const updatedBook = await Book.findOneAndUpdate({ book_id }, req.body, { new: true });

      if (!updatedBook) {
        return res.status(404).json({ error: 'Book not found' });
      }

      res.status(200).json({ message: 'Book updated successfully', book: updatedBook });
    } catch (err) {
      console.error(`Error updating book ${req.params.book_id}:`, err.message);
      res.status(500).json({ error: 'Failed to update book' });
    }
};

/**
 * Controller to delete a book. Admin only.
 */
const deleteBook = async (req, res) => {
    try {
        const { book_id } = req.params;
        const deletedBook = await Book.findOneAndDelete({ book_id });

        if (!deletedBook) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.status(200).json({ message: 'Book deleted successfully' });
    } catch (err) {
        console.error(`Error deleting book ${req.params.book_id}:`, err.message);
        res.status(500).json({ error: 'Failed to delete book' });
    }
};


// ===================================================================================
// ROUTES
// ===================================================================================

/**
 * @route   GET /api/books
 * @desc    Retrieve list of books with optional filters
 * @access  Public
 */
router.get('/', getAllBooks);

/**
 * @route   GET /api/books/filters
 * @desc    Retrieve unique values for filters
 * @access  Public
 */
router.get('/filters', getBookFilters);

/**
 * @route   GET /api/books/details/:bookId
 * @desc    [NEW] Retrieve book details for QR scanner workflow
 * @access  Authenticated Users (or Public, depending on your needs)
 */
router.get('/details/:bookId', getBookDetailsForScanner);

/**
 * @route   GET /api/books/:book_id
 * @desc    Retrieve a specific book by its public ID
 * @access  Public
 */
router.get('/:book_id', getBookById);

/**
 * @route   POST /api/books
 * @desc    Create a new book
 * @access  Admin
 */
router.post('/', authMiddleware, adminMiddleware, bookValidationRules, createBook);

/**
 * @route   PUT /api/books/:book_id
 * @desc    Update a book
 * @access  Admin
 */
router.put('/:book_id', authMiddleware, adminMiddleware, bookValidationRules, updateBook);

/**
 * @route   DELETE /api/books/:book_id
 * @desc    Delete a book
 * @access  Admin
 */
router.delete('/:book_id', authMiddleware, adminMiddleware, deleteBook);


module.exports = router;