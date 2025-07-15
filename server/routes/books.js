const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Book = require('../models/Book');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Received token in authMiddleware:', token); // Debug log
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token in authMiddleware:', decoded); // Debug log
    req.userId = decoded.id;
    next();
  } catch (err) {
    console.error('Token verification failed in authMiddleware:', err.message); // Debug log
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check admin role
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/books - Retrieve list of books with case-insensitive filtering (no auth required)
router.get('/', async (req, res) => {
  try {
    const { genre, author, language, name, keeper_id, available, hasAudio, hasDownload } = req.query;
    let query = {};

    if (genre) query.genre = { $regex: genre, $options: 'i' };
    if (author) query.author = { $regex: author, $options: 'i' };
    if (language) query.language = { $regex: language, $options: 'i' };
    if (name) query.name = { $regex: name, $options: 'i' };
    if (keeper_id) query.keeper_id = keeper_id;
    if (available) query.available = available === 'true';
    if (hasAudio === 'true') query.audio_url = { $ne: null, $exists: true }; // Filter books with non-null audio_url
    if (hasDownload === 'true') query.pdf_url = { $ne: null, $exists: true }; // Filter books with non-null pdf_url

    const books = await Book.find(query);
    res.status(200).json(books);
  } catch (err) {
    console.error('Error fetching books:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/filters - Retrieve unique values for filters (no auth required)
router.get('/filters', async (req, res) => {
  try {
    const authors = await Book.distinct('author');
    const publishers = await Book.distinct('publisher');
    const genres = await Book.distinct('genre');
    const languages = await Book.distinct('language');
    const keeperIds = (await Book.distinct('keeper_id')).filter(id => id);

    res.status(200).json({ authors, publishers, genres, languages, keeperIds });
  } catch (err) {
    console.error('Error fetching filters:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:book_id - Retrieve a specific book (no auth required)
router.get('/:book_id', async (req, res) => {
  try {
    const { book_id } = req.params;
    const book = await Book.findOne({ book_id });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.status(200).json(book);
  } catch (err) {
    console.error('Error fetching book:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books - Create a new book (admin-only)
router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  [
    body('name').notEmpty().withMessage('name is required').trim(),
    body('author').notEmpty().withMessage('author is required').trim(),
    body('language').notEmpty().withMessage('language is required').trim(),
    body('ratings').optional().isInt({ min: 0, max: 5 }).withMessage('ratings must be between 0 and 5'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        name,
        author,
        language,
        publisher,
        genre,
        description,
        image_url,
        audio_url,
        pdf_url,
        ratings,
        is_free,
        available,
        keeper_id,
      } = req.body;

      const book = new Book({
        name,
        author,
        language,
        publisher,
        genre,
        description,
        image_url,
        audio_url,
        pdf_url,
        ratings: ratings || 0,
        is_free: is_free || false,
        available: available !== undefined ? available : true,
        keeper_id: keeper_id || null,
      });

      await book.save();
      res.status(201).json({ message: 'Book created successfully', book });
    } catch (err) {
      console.error('Error creating book:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/books/:book_id - Update a book (admin-only)
router.put(
  '/:book_id',
  authMiddleware,
  adminMiddleware,
  [
    body('name').notEmpty().withMessage('name is required').trim(),
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
      const { book_id } = req.params;
      const {
        name,
        author,
        language,
        publisher,
        genre,
        description,
        image_url,
        audio_url,
        pdf_url,
        ratings,
        is_free,
        available,
        keeper_id,
      } = req.body;

      const book = await Book.findOne({ book_id });
      if (!book) {
        return res.status(404).json({ error: 'Book not found' });
      }

      book.name = name;
      book.author = author;
      book.language = language;
      book.publisher = publisher !== undefined ? publisher : book.publisher;
      book.genre = genre !== undefined ? genre : book.genre;
      book.description = description !== undefined ? description : book.description;
      book.image_url = image_url !== undefined ? image_url : book.image_url;
      book.audio_url = audio_url !== undefined ? audio_url : book.audio_url;
      book.pdf_url = pdf_url !== undefined ? pdf_url : book.pdf_url;
      book.ratings = ratings !== undefined ? ratings : book.ratings;
      book.is_free = is_free !== undefined ? is_free : book.is_free;
      book.available = available !== undefined ? available : book.available;
      book.keeper_id = keeper_id !== undefined ? keeper_id : book.keeper_id;
      book.updatedAt = Date.now();

      await book.save();
      console.log('Book updated:', book);
      res.status(200).json({ message: 'Book updated successfully', book });
    } catch (err) {
      console.error('Error updating book:', err.message);
      res.status(500).json({ error: 'Failed to update book: ' + err.message });
    }
  }
);

// DELETE /api/books/:book_id - Delete a book (admin-only)
router.delete('/:book_id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { book_id } = req.params;
    const book = await Book.findOne({ book_id });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    await book.deleteOne();
    console.log(`Book deleted: ${book_id}`);
    res.status(200).json({ message: 'Book deleted successfully' });
  } catch (err) {
    console.error('Error deleting book:', err.message);
    res.status(500).json({ error: 'Failed to delete book: ' + err.message });
  }
});

module.exports = router;