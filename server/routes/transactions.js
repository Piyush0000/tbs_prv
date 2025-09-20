const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const Cafe = require('../models/Cafe');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('Authorization header:', authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No token provided or invalid format');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Token extracted:', token);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', decoded);
    req.userId = decoded.id;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/transactions - Retrieve list of transactions with case-insensitive filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, user_id } = req.query;
    let query = {};

    if (status) query.status = { $regex: status, $options: 'i' };
    if (user_id) {
      const user = await User.findOne({ user_id });
      if (!user) {
        logger.warn(`User not found for user_id: ${user_id}`);
        return res.status(404).json({ error: 'User not found' });
      }
      query.user_id = user._id;
    }

    const transactions = await Transaction.find(query)
      .populate('book_id')
      .populate('user_id')
      .populate('cafe_id');
    res.status(200).json(transactions);
  } catch (err) {
    logger.error(`Error fetching transactions: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/filters - Retrieve unique values for filters
router.get('/filters', authMiddleware, async (req, res) => {
  try {
    const statuses = await Transaction.distinct('status');
    res.status(200).json({ statuses });
  } catch (err) {
    logger.error(`Error fetching transaction filters: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions - Create a new transaction (pickup request)
router.post(
  '/',
  authMiddleware,
  [
    body('book_id').notEmpty().withMessage('book_id is required').trim(),
    body('cafe_id').notEmpty().withMessage('cafe_id is required').trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Validation error on POST /api/transactions: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ errors: errors.array() });
    }

    const { book_id, cafe_id } = req.body;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const user = await User.findById(req.userId).session(session);
      if (!user) {
        logger.warn(`User not found: ${req.userId}`);
        await session.abortTransaction();
        return res.status(404).json({ error: 'User not found' });
      }

      const currentDate = new Date();
      if (user.subscription_validity < currentDate || user.deposit_status !== 'deposited') {
        logger.warn(`Invalid subscription or deposit for user: ${user.user_id}`);
        await session.abortTransaction();
        return res.status(400).json({ error: 'Active subscription and deposit required' });
      }

      const pendingTransactions = await Transaction.find({
        user_id: user._id,
        status: { $in: ['pickup_pending', 'picked_up', 'dropoff_pending'] },
      }).session(session);
      if (pendingTransactions.length > 0) {
        logger.warn(`User has pending transactions: ${user.user_id}`);
        await session.abortTransaction();
        return res.status(400).json({ error: 'Complete pending transactions before requesting another book' });
      }

      const book = await Book.findOne({ book_id }).session(session);
      if (!book) {
        logger.warn(`Book not found: ${book_id}`);
        await session.abortTransaction();
        return res.status(404).json({ error: 'Book not found' });
      }
      if (!book.available) {
        logger.warn(`Book unavailable: ${book_id}`);
        await session.abortTransaction();
        return res.status(400).json({ error: 'Book is currently unavailable' });
      }

      const cafe = await Cafe.findOne({ cafe_id }).session(session);
      if (!cafe) {
        logger.warn(`Cafe not found: ${cafe_id}`);
        await session.abortTransaction();
        return res.status(404).json({ error: 'Cafe not found' });
      }

      if (user.book_id && user.subscription_type === 'basic') {
        logger.warn(`Subscription limit exceeded for user: ${user.user_id}`);
        await session.abortTransaction();
        return res.status(400).json({ error: 'Basic subscription allows only one book at a time' });
      }

      // Generate unique transaction ID
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;
      let newTransactionId;

      while (!isUnique && attempts < maxAttempts) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        newTransactionId = `TXN_${timestamp}_${randomStr}`;

        console.log(`Attempt ${attempts + 1}: Checking uniqueness of transaction_id: ${newTransactionId}`);
        const existingTransaction = await Transaction.findOne({ transaction_id: newTransactionId }).session(session);
        if (!existingTransaction) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new Error('Failed to generate a unique transaction_id after multiple attempts');
      }

      const transactionData = {
        transaction_id: newTransactionId,
        book_id: book._id,
        user_id: user._id,
        cafe_id: cafe._id,
        status: 'pickup_pending',
      };

      const transaction = new Transaction(transactionData);
      console.log('Transaction before save:', transaction);

      await transaction.save({ session });
      logger.info(`Transaction created successfully: ${transaction.transaction_id} for user: ${user.user_id}`);

      // Reserve the book but don't assign to user yet (that happens on pickup approval)
      book.available = false;
      book.updatedAt = new Date();
      await book.save({ session });

      await session.commitTransaction();
      res.status(201).json({ message: 'Pickup request created successfully', transaction });
    } catch (err) {
      await session.abortTransaction();
      logger.error(`Error creating transaction: ${err.message}, Stack: ${err.stack}`);
      res.status(500).json({ error: `Failed to create transaction: ${err.message}` });
    } finally {
      session.endSession();
    }
  }
);

// GET /api/transactions/:transaction_id - Get specific transaction
router.get('/:transaction_id', async (req, res) => {
    try {
        const { transaction_id } = req.params;
        console.log('Looking for transaction:', transaction_id);
        
        // Populate the book_id to get the actual book_id string
        const transaction = await Transaction.findOne({ 
            transaction_id: transaction_id 
        }).populate('book_id', 'book_id name title'); // Add populate here
        
        if (!transaction) {
            return res.status(404).json({ 
                error: 'Transaction not found',
                requestedId: transaction_id
            });
        }
        
        res.json({
            transaction_id: transaction.transaction_id,
            book_id: transaction.book_id?.book_id || transaction.book_id, // Return the string book_id
            user_id: transaction.user_id,
            cafe_id: transaction.cafe_id,
            status: transaction.status,
            created_at: transaction.created_at
        });
        
    } catch (err) {
        console.error('Transaction fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/transactions/approve/:transaction_id - Approve transaction (PICKUP PROCESS)
router.put(
  '/approve/:transaction_id',
  authMiddleware,
  async (req, res) => {
    const { transaction_id } = req.params;
    const { book_id } = req.body;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Find the transaction
      const transaction = await Transaction.findOne({ transaction_id }).session(session);
      if (!transaction) {
        logger.warn(`Transaction not found: ${transaction_id}`);
        await session.abortTransaction();
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Verify transaction is in correct state for approval
      if (transaction.status !== 'pickup_pending') {
        logger.warn(`Transaction not in pickup_pending state: ${transaction_id}, status: ${transaction.status}`);
        await session.abortTransaction();
        return res.status(400).json({ 
          error: `Transaction is not pending pickup. Current status: ${transaction.status}` 
        });
      }

      // Get the book from transaction
      const book = await Book.findById(transaction.book_id).session(session);
      if (!book) {
        logger.warn(`Book not found for transaction: ${transaction_id}`);
        await session.abortTransaction();
        return res.status(404).json({ error: 'Book not found' });
      }

      // Verify the book_id matches if provided
      if (book_id && book.book_id !== book_id) {
        logger.warn(`Book ID mismatch: expected ${book.book_id}, got ${book_id}`);
        await session.abortTransaction();
        return res.status(400).json({ 
          error: `Book ID mismatch. Expected: ${book.book_id}, Provided: ${book_id}` 
        });
      }

      // Get the user
      const user = await User.findById(transaction.user_id).session(session);
      if (!user) {
        logger.warn(`User not found for transaction: ${transaction_id}`);
        await session.abortTransaction();
        return res.status(404).json({ error: 'User not found' });
      }

      // Update transaction status to picked_up
      transaction.status = 'picked_up';
      transaction.processed_at = new Date();
      await transaction.save({ session });

      // Update book - assign to user
      book.available = false;
      book.keeper_id = user.user_id;
      book.updatedAt = new Date();
      await book.save({ session });

      // Update user - assign book to user
      user.book_id = book.book_id;
      user.updatedAt = new Date();
      await user.save({ session });

      await session.commitTransaction();
      logger.info(`Pickup transaction approved: ${transaction_id}`);
      res.status(200).json({ 
        message: 'Transaction approved successfully', 
        transaction,
        book: { book_id: book.book_id, title: book.title }
      });
    } catch (err) {
      await session.abortTransaction();
      logger.error(`Error approving transaction: ${err.message}`);
      res.status(500).json({ error: err.message });
    } finally {
      session.endSession();
    }
  }
);

// PUT /api/transactions/drop-off/:book_id - Initiate drop-off process
router.put('/drop-off/:book_id', authMiddleware, async (req, res) => {
  const { book_id } = req.params;
  const { cafe_id } = req.body;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (!cafe_id) {
      return res.status(400).json({ error: 'cafe_id is required' });
    }

    const user = await User.findById(req.userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'User not found' });
    }

    const book = await Book.findOne({ book_id }).session(session);
    if (!book) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Book not found' });
    }

    // Check if user currently has this book
    if (user.book_id !== book_id) {
      await session.abortTransaction();
      return res.status(400).json({ 
        error: `This book is not assigned to you. Your current book: ${user.book_id}` 
      });
    }

    // Verify book is currently with the user
    if (book.keeper_id !== user.user_id) {
      await session.abortTransaction();
      return res.status(400).json({ 
        error: 'Book is not currently in your possession' 
      });
    }

    // Check if there's an active picked_up transaction for this book and user
    const activeTransaction = await Transaction.findOne({
      book_id: book._id,
      user_id: user._id,
      status: 'picked_up'
    }).session(session);

    if (!activeTransaction) {
      await session.abortTransaction();
      return res.status(400).json({ 
        error: 'No active pickup transaction found. You need to pick up the book first.' 
      });
    }

    const cafe = await Cafe.findOne({ cafe_id }).session(session);
    if (!cafe) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Cafe not found' });
    }

    // Update the existing transaction to drop-off pending
    activeTransaction.status = 'dropoff_pending';
    activeTransaction.cafe_id = cafe._id; // Update the cafe for drop-off
    activeTransaction.updatedAt = new Date();
    await activeTransaction.save({ session });

    await session.commitTransaction();
    logger.info(`Drop-off request initiated: ${activeTransaction.transaction_id}`);
    res.status(200).json({ 
      message: 'Drop-off request initiated successfully', 
      transaction: activeTransaction 
    });

  } catch (err) {
    await session.abortTransaction();
    logger.error(`Error initiating drop-off: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// PUT /api/transactions/complete-dropoff/:transaction_id - Complete drop-off process (ADMIN/SCANNER)
router.put('/complete-dropoff/:transaction_id', authMiddleware, async (req, res) => {
  const { transaction_id } = req.params;
  const { book_id } = req.body;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    console.log(`Completing drop-off for transaction: ${transaction_id}`);
    
    const transaction = await Transaction.findOne({ 
      transaction_id, 
      status: 'dropoff_pending' 
    }).session(session);
    
    if (!transaction) {
      logger.warn(`No pending drop-off transaction: ${transaction_id}`);
      await session.abortTransaction();
      return res.status(404).json({ error: 'No pending drop-off transaction found' });
    }

    const book = await Book.findById(transaction.book_id).session(session);
    if (!book) {
      logger.warn(`Book not found for drop-off completion: ${transaction.book_id}`);
      await session.abortTransaction();
      return res.status(404).json({ error: 'Book not found' });
    }

    // Verify the book_id matches if provided (for scanner verification)
    if (book_id && book.book_id !== book_id) {
      logger.warn(`Book ID mismatch during drop-off: expected ${book.book_id}, got ${book_id}`);
      await session.abortTransaction();
      return res.status(400).json({ 
        error: `Book ID mismatch. Expected: ${book.book_id}, Provided: ${book_id}` 
      });
    }

    const user = await User.findById(transaction.user_id).session(session);
    if (!user) {
      logger.warn(`User not found for drop-off completion: ${transaction.user_id}`);
      await session.abortTransaction();
      return res.status(404).json({ error: 'User not found' });
    }

    const cafe = await Cafe.findById(transaction.cafe_id).session(session);
    if (!cafe) {
      logger.warn(`Cafe not found for drop-off completion: ${transaction.cafe_id}`);
      await session.abortTransaction();
      return res.status(404).json({ error: 'Cafe not found' });
    }

    // Complete the drop-off transaction
    transaction.status = 'dropped_off';
    transaction.processed_at = new Date();
    await transaction.save({ session });

    // Update book - make it available and assign to cafe
    book.available = true;
    book.keeper_id = cafe.cafe_id;
    book.updatedAt = new Date();
    await book.save({ session });

    // Update user - remove book assignment
    user.book_id = null;
    user.updatedAt = new Date();
    await user.save({ session });

    await session.commitTransaction();
    logger.info(`Drop-off completed successfully: ${transaction.transaction_id}`);
    res.status(200).json({ 
      message: 'Book drop-off completed successfully', 
      transaction,
      book: { book_id: book.book_id, title: book.title },
      cafe: { cafe_id: cafe.cafe_id, name: cafe.name }
    });
  } catch (err) {
    await session.abortTransaction();
    logger.error(`Error completing drop-off: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// DELETE /api/transactions/cancel/:transaction_id - Cancel a pickup request
router.delete('/cancel/:transaction_id', authMiddleware, async (req, res) => {
  const { transaction_id } = req.params;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const transaction = await Transaction.findOne({ 
      transaction_id, 
      status: 'pickup_pending' 
    }).session(session);
    
    if (!transaction) {
      logger.warn(`No pending pickup transaction found for transaction_id: ${transaction_id}`);
      await session.abortTransaction();
      return res.status(404).json({ error: 'No pending pickup transaction found' });
    }

    const user = await User.findById(req.userId).session(session);
    if (!user) {
      logger.warn(`User not found for cancelling transaction: ${req.userId}`);
      await session.abortTransaction();
      return res.status(404).json({ error: 'User not found' });
    }

    if (String(transaction.user_id) !== String(user._id)) {
      logger.warn(`Unauthorized attempt to cancel transaction: ${transaction_id} by user: ${user.user_id}`);
      await session.abortTransaction();
      return res.status(403).json({ error: 'Unauthorized to cancel this transaction' });
    }

    const book = await Book.findById(transaction.book_id).session(session);
    if (!book) {
      logger.warn(`Book not found for cancelling transaction: ${transaction.book_id}`);
      await session.abortTransaction();
      return res.status(404).json({ error: 'Book not found' });
    }

    const cafe = await Cafe.findById(transaction.cafe_id).session(session);
    if (!cafe) {
      logger.warn(`Cafe not found for cancelling transaction: ${transaction.cafe_id}`);
      await session.abortTransaction();
      return res.status(404).json({ error: 'Cafe not found' });
    }

    // Delete the transaction
    await transaction.deleteOne({ session });

    // Make book available again and assign back to cafe
    book.available = true;
    book.keeper_id = cafe.cafe_id;
    book.updatedAt = new Date();
    await book.save({ session });

    await session.commitTransaction();
    logger.info(`Pickup request cancelled successfully: ${transaction_id}`);
    res.status(200).json({ message: 'Pickup request cancelled successfully' });
  } catch (err) {
    await session.abortTransaction();
    logger.error(`Error cancelling pickup request: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

module.exports = router;