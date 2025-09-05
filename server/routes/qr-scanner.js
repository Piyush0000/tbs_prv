const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Book = require('../models/Book');
const Transaction = require('../models/Transaction');
const jwt = require('jsonwebtoken');

// ===================================================================================
// MIDDLEWARE
// ===================================================================================

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

const cafeMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || (user.role !== 'cafe' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Forbidden: Cafe or Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error while verifying cafe role' });
  }
};

// ===================================================================================
// QR SCANNER FUNCTIONS
// ===================================================================================

/**
 * @route   GET /api/qr-scanner/user/:userId
 * @desc    Get user details and current book status for QR scanning
 * @access  Cafe/Admin
 */
router.get('/user/:userId', authMiddleware, cafeMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user by user_id (the public ID, not MongoDB _id)
    const user = await User.findOne({ user_id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check user's subscription status
    const currentDate = new Date();
    const hasValidSubscription = user.subscription_validity && user.subscription_validity > currentDate;

    if (!hasValidSubscription) {
      return res.status(400).json({ 
        error: 'User does not have an active subscription',
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          subscription_type: user.subscription_type,
          subscription_validity: user.subscription_validity
        }
      });
    }

    // Get user's current book (if any)
    let currentBook = null;
    if (user.book_id) {
      currentBook = await Book.findOne({ book_id: user.book_id });
    }

    // Check for any pending transactions
    const pendingTransactions = await Transaction.find({
      user_id: user._id,
      status: { $in: ['pickup_pending', 'dropoff_pending'] }
    }).populate('book_id');

    const response = {
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        subscription_type: user.subscription_type,
        subscription_validity: user.subscription_validity,
        hasValidSubscription: true
      },
      currentBook: currentBook ? {
        book_id: currentBook.book_id,
        name: currentBook.name,
        author: currentBook.author,
        genre: currentBook.genre,
        language: currentBook.language
      } : null,
      pendingTransactions: pendingTransactions.map(t => ({
        transaction_id: t.transaction_id,
        book: {
          book_id: t.book_id.book_id,
          name: t.book_id.name,
          author: t.book_id.author
        },
        status: t.status,
        transaction_date: t.transaction_date
      })),
      canTakeNewBook: !user.book_id && pendingTransactions.length === 0,
      hasBookToReturn: !!user.book_id
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting user details:', error);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

/**
 * @route   POST /api/qr-scanner/assign-book
 * @desc    Assign a book to a user (after QR scanning)
 * @access  Cafe/Admin
 */
router.post('/assign-book', authMiddleware, cafeMiddleware, async (req, res) => {
  try {
    const { userId, bookId } = req.body;

    if (!userId || !bookId) {
      return res.status(400).json({ error: 'User ID and Book ID are required' });
    }

    // Find user
    const user = await User.findOne({ user_id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check subscription validity
    const currentDate = new Date();
    const hasValidSubscription = user.subscription_validity && user.subscription_validity > currentDate;
    
    if (!hasValidSubscription) {
      return res.status(400).json({ 
        error: 'User does not have an active subscription' 
      });
    }

    // Check if user already has a book
    if (user.book_id) {
      const currentBook = await Book.findOne({ book_id: user.book_id });
      return res.status(400).json({ 
        error: 'User already has a book assigned',
        message: 'Please return the current book before taking a new one',
        currentBook: currentBook ? {
          book_id: currentBook.book_id,
          name: currentBook.name,
          author: currentBook.author
        } : null
      });
    }

    // Check for pending transactions
    const pendingTransactions = await Transaction.find({
      user_id: user._id,
      status: { $in: ['pickup_pending', 'dropoff_pending'] }
    });

    if (pendingTransactions.length > 0) {
      return res.status(400).json({ 
        error: 'User has pending transactions. Please complete them first.' 
      });
    }

    // Find and check book availability
    const book = await Book.findOne({ book_id: bookId });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (!book.available) {
      return res.status(400).json({ 
        error: 'Book is not available for assignment',
        book: {
          book_id: book.book_id,
          name: book.name,
          author: book.author
        }
      });
    }

    // Assign book to user
    user.book_id = book.book_id;
    await user.save();

    // Make book unavailable
    book.available = false;
    book.updatedAt = new Date();
    await book.save();

    // Create transaction record
    const transaction = new Transaction({
      user_id: user._id,
      book_id: book._id,
      transaction_type: 'pickup',
      status: 'completed',
      transaction_date: new Date()
    });
    await transaction.save();

    console.log(`Book ${book.book_id} assigned to user ${user.user_id}`);

    res.status(200).json({
      message: 'Book assigned successfully',
      user: {
        user_id: user.user_id,
        name: user.name
      },
      book: {
        book_id: book.book_id,
        name: book.name,
        author: book.author,
        genre: book.genre
      },
      transaction: {
        transaction_id: transaction.transaction_id,
        transaction_date: transaction.transaction_date
      }
    });

  } catch (error) {
    console.error('Error assigning book:', error);
    res.status(500).json({ error: 'Failed to assign book' });
  }
});

/**
 * @route   POST /api/qr-scanner/return-book
 * @desc    Return a book from a user (unassign)
 * @access  Cafe/Admin
 */
router.post('/return-book', authMiddleware, cafeMiddleware, async (req, res) => {
  try {
    const { userId, bookId, confirmation = false } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find user
    const user = await User.findOne({ user_id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has any book assigned
    if (!user.book_id) {
      return res.status(400).json({ 
        error: 'User does not have any book assigned' 
      });
    }

    // If specific book ID provided, verify it matches user's book
    if (bookId && user.book_id !== bookId) {
      return res.status(400).json({ 
        error: 'The specified book is not assigned to this user',
        userBook: user.book_id,
        requestedBook: bookId
      });
    }

    // Get the book details
    const book = await Book.findOne({ book_id: user.book_id });
    if (!book) {
      return res.status(404).json({ 
        error: 'Book not found in database',
        book_id: user.book_id 
      });
    }

    // If no confirmation provided, ask for confirmation
    if (!confirmation) {
      return res.status(200).json({
        requiresConfirmation: true,
        message: 'Please confirm book return',
        user: {
          user_id: user.user_id,
          name: user.name
        },
        book: {
          book_id: book.book_id,
          name: book.name,
          author: book.author,
          genre: book.genre
        }
      });
    }

    // Process the return
    const returnedBookId = user.book_id;
    user.book_id = null;
    await user.save();

    // Make book available again
    book.available = true;
    book.updatedAt = new Date();
    await book.save();

    // Create return transaction record
    const transaction = new Transaction({
      user_id: user._id,
      book_id: book._id,
      transaction_type: 'dropoff',
      status: 'completed',
      transaction_date: new Date()
    });
    await transaction.save();

    console.log(`Book ${returnedBookId} returned by user ${user.user_id}`);

    res.status(200).json({
      message: 'Book returned successfully',
      user: {
        user_id: user.user_id,
        name: user.name
      },
      returnedBook: {
        book_id: book.book_id,
        name: book.name,
        author: book.author
      },
      transaction: {
        transaction_id: transaction.transaction_id,
        transaction_date: transaction.transaction_date
      }
    });

  } catch (error) {
    console.error('Error returning book:', error);
    res.status(500).json({ error: 'Failed to return book' });
  }
});

/**
 * @route   GET /api/qr-scanner/user-books/:userId
 * @desc    Get all books currently with a user
 * @access  Cafe/Admin
 */
router.get('/user-books/:userId', authMiddleware, cafeMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findOne({ user_id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const books = [];
    if (user.book_id) {
      const book = await Book.findOne({ book_id: user.book_id });
      if (book) {
        books.push({
          book_id: book.book_id,
          name: book.name,
          author: book.author,
          genre: book.genre,
          language: book.language
        });
      }
    }

    res.status(200).json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email
      },
      books: books,
      totalBooks: books.length
    });

  } catch (error) {
    console.error('Error getting user books:', error);
    res.status(500).json({ error: 'Failed to get user books' });
  }
});

/**
 * @route   POST /api/qr-scanner/force-return
 * @desc    Force return a book without user confirmation (emergency)
 * @access  Admin only
 */
router.post('/force-return', authMiddleware, async (req, res) => {
  try {
    // Check admin role
    const adminUser = await User.findById(req.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId, bookId, reason } = req.body;

    if (!userId || !reason) {
      return res.status(400).json({ error: 'User ID and reason are required' });
    }

    const user = await User.findOne({ user_id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.book_id) {
      return res.status(400).json({ error: 'User has no book assigned' });
    }

    if (bookId && user.book_id !== bookId) {
      return res.status(400).json({ error: 'Book ID does not match user\'s assigned book' });
    }

    const book = await Book.findOne({ book_id: user.book_id });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Force return
    const returnedBookId = user.book_id;
    user.book_id = null;
    await user.save();

    book.available = true;
    book.updatedAt = new Date();
    await book.save();

    // Create transaction with reason
    const transaction = new Transaction({
      user_id: user._id,
      book_id: book._id,
      transaction_type: 'dropoff',
      status: 'completed',
      transaction_date: new Date(),
      notes: `Force return by admin: ${reason}`
    });
    await transaction.save();

    console.log(`Force return: Book ${returnedBookId} from user ${user.user_id}. Reason: ${reason}`);

    res.status(200).json({
      message: 'Book force returned successfully',
      user: {
        user_id: user.user_id,
        name: user.name
      },
      returnedBook: {
        book_id: book.book_id,
        name: book.name,
        author: book.author
      },
      reason: reason,
      transaction: {
        transaction_id: transaction.transaction_id,
        transaction_date: transaction.transaction_date
      }
    });

  } catch (error) {
    console.error('Error in force return:', error);
    res.status(500).json({ error: 'Failed to force return book' });
  }
});

/**
 * @route   GET /api/qr-scanner/book-status/:bookId
 * @desc    Get current status and assignment details of a book
 * @access  Cafe/Admin
 */
router.get('/book-status/:bookId', authMiddleware, cafeMiddleware, async (req, res) => {
  try {
    const { bookId } = req.params;
    
    const book = await Book.findOne({ book_id: bookId });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    let assignedUser = null;
    if (!book.available) {
      // Find who has this book
      const user = await User.findOne({ book_id: bookId });
      if (user) {
        assignedUser = {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          phone_number: user.phone_number
        };
      }
    }

    // Get recent transactions for this book
    const recentTransactions = await Transaction.find({ book_id: book._id })
      .sort({ transaction_date: -1 })
      .limit(5)
      .populate('user_id', 'user_id name email');

    res.status(200).json({
      book: {
        book_id: book.book_id,
        name: book.name,
        author: book.author,
        genre: book.genre,
        language: book.language,
        available: book.available
      },
      assignedUser: assignedUser,
      recentTransactions: recentTransactions.map(t => ({
        transaction_id: t.transaction_id,
        transaction_type: t.transaction_type,
        status: t.status,
        transaction_date: t.transaction_date,
        user: {
          user_id: t.user_id.user_id,
          name: t.user_id.name
        }
      }))
    });

  } catch (error) {
    console.error('Error getting book status:', error);
    res.status(500).json({ error: 'Failed to get book status' });
  }
});

module.exports = router;