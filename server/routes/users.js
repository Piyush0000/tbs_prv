const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const Razorpay = require('razorpay');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');


require('dotenv').config();
// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

// Middleware to check admin role
const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        console.log('User found in adminMiddleware:', user);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (err) {
        console.error('Admin middleware error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/users/profile - Retrieve the authenticated user's profile
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            phone_number: user.phone_number,
            subscription_type: user.subscription_type,
            subscription_validity: user.subscription_validity,
            book_id: user.book_id,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    } catch (err) {
        console.error('Error fetching user profile:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users - Retrieve list of users with case-insensitive filtering
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { subscription_type, role } = req.query;
        let query = {};

        if (subscription_type) query.subscription_type = { $regex: subscription_type, $options: 'i' };
        if (role) query.role = { $regex: role, $options: 'i' };

        const users = await User.find(query);
        console.log('Users fetched:', users);
        res.status(200).json(users);
    } catch (err) {
        console.error('Error fetching users:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users/filters - Retrieve unique values for filters
router.get('/filters', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const subscription_types = await User.distinct('subscription_type');
        const roles = await User.distinct('role');

        console.log('Filter options fetched:', { subscription_types, roles });
        res.status(200).json({ subscription_types, roles });
    } catch (err) {
        console.error('Error fetching user filters:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users/:user_id - Retrieve a specific user
router.get('/:user_id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { user_id } = req.params;
        const user = await User.findOne({ user_id });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('User fetched:', user);
        res.status(200).json(user);
    } catch (err) {
        console.error('Error fetching user:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users - Create a new user (admin-only)
router.post(
    '/',
    authMiddleware,
    adminMiddleware,
    [
        body('name')
            .notEmpty()
            .withMessage('Name is required')
            .trim(),
        body('email')
            .isEmail()
            .withMessage('Valid email is required')
            .trim(),
        body('phone_number')
            .notEmpty()
            .withMessage('Phone number is required')
            .trim(),
        body('password')
            .notEmpty()
            .withMessage('Password is required'),
        body('subscription_type')
            .optional()
            .isIn(['basic', 'standard', 'premium'])
            .withMessage('Subscription type must be basic, standard, or premium'),
        body('role')
            .optional()
            .isIn(['user', 'admin', 'cafe'])
            .withMessage('Role must be user or admin or cafe'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { name, email, phone_number, password, subscription_type, role } = req.body;

            const user = new User({
                name,
                email,
                phone_number,
                password,
                subscription_type: subscription_type || 'basic',
                role: role || 'user',
                subscription_validity: new Date(),
            });

            // Fallback: Generate user_id if not set by the model
            if (!user.user_id) {
                console.log('user_id not set by model, generating manually...');
                const count = await User.countDocuments();
                user.user_id = `User_${String(count + 1).padStart(3, '0')}`;
                console.log('Manually generated user_id:', user.user_id);
            }

            let savedUser;
            let attempts = 0;
            const maxAttempts = 3;

            // Retry saving the user in case of duplicate user_id
            while (attempts < maxAttempts) {
                try {
                    savedUser = await user.save();
                    break; // Success, exit the loop
                } catch (err) {
                    if (err.code === 11000 && err.keyPattern && err.keyPattern.user_id) {
                        // Duplicate key error for user_id, retry with a new user_id
                        attempts++;
                        console.log(`Duplicate user_id detected, retrying (${attempts}/${maxAttempts})...`);
                        const count = await User.countDocuments();
                        user.user_id = `User_${String(count + 1).padStart(3, '0')}`;
                        continue;
                    }
                    throw err; // Other errors, throw immediately
                }
            }

            if (!savedUser) {
                throw new Error('Failed to save user after multiple attempts due to duplicate user_id');
            }

            console.log('User created:', savedUser);
            res.status(201).json({ message: 'User created successfully', user: savedUser });
        } catch (err) {
            console.error('Error creating user:', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// PUT /api/users/:user_id - Update a user (admin-only)
router.put(
    '/:user_id',
    authMiddleware,
    adminMiddleware,
    [
        body('name')
            .optional()
            .notEmpty()
            .withMessage('Name cannot be empty')
            .trim(),
        body('email')
            .optional()
            .isEmail()
            .withMessage('Valid email is required')
            .trim(),
        body('phone_number')
            .optional()
            .notEmpty()
            .withMessage('Phone number cannot be empty')
            .trim(),
        body('password')
            .optional()
            .notEmpty()
            .withMessage('Password cannot be empty'),
        body('subscription_type')
            .optional()
            .isIn(['basic', 'standard', 'premium'])
            .withMessage('Subscription type must be basic, standard, or premium'),
        body('role')
            .optional()
            .isIn(['user', 'admin', 'cafe'])
            .withMessage('Role must be user or admin or cafe'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { user_id } = req.params;
            const updates = req.body;

            const user = await User.findOne({ user_id });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            Object.assign(user, updates);
            await user.save(); // updatedAt will be set by the pre-save hook

            console.log('User updated:', user);
            res.status(200).json({ message: 'User updated successfully', user });
        } catch (err) {
            console.error('Error updating user:', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// DELETE /api/users/:user_id - Delete a user (admin-only)
router.delete('/:user_id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { user_id } = req.params;
        const user = await User.findOne({ user_id });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await user.deleteOne();
        console.log('User deleted:', user);
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users/create-subscription - Create a Razorpay order for subscription
router.post('/create-subscription', authMiddleware, async (req, res) => {
    try {
        const { tier, amount, isCodeApplied } = req.body;
        if (!['basic', 'standard', 'premium'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid subscription tier' });
        }
        if (!amount || typeof amount !== 'number') {
            return res.status(400).json({ error: 'Amount is required and must be a number' });
        }

        // Define expected amounts for each plan (in INR)
        const planAmounts = {
            basic: 49.00,
            standard: 49.00,
            premium: 199.99,
        };
        const depositFee = 299.00;

        // Validate amount based on coupon application
        let expectedAmount;
        if (isCodeApplied) {
            expectedAmount = depositFee; // Only deposit fee when coupon is applied
        } else {
            expectedAmount = planAmounts[tier] + depositFee; // Plan fee + deposit fee
        }

        if (amount !== expectedAmount) {
            return res.status(400).json({ error: `Invalid amount for ${tier} plan. Expected ${expectedAmount} INR` });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create a Razorpay order
        const options = {
            amount: amount * 100, // Convert to paise (Razorpay expects amount in paise)
            currency: 'INR',
            receipt: `receipt_${user.user_id}_${Date.now()}`,
            notes: {
                user_id: user.user_id,
                tier: tier,
                isCodeApplied: isCodeApplied,
            },
        };

        const order = await razorpay.orders.create(options);
        console.log(`Razorpay order created for user ${user.user_id}: ${order.id}`);

        res.status(200).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID, // Send the Key ID to the frontend
        });
    } catch (err) {
        console.error('Error creating Razorpay order:', err.message);
        res.status(500).json({ error: `Failed to create order: ${err.message}` });
    }
});

// POST /api/users/verify-subscription-payment - Verify Razorpay payment and update subscription
router.post('/verify-subscription-payment', authMiddleware, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, tier, amount, isCodeApplied } = req.body;

        // Validate the request
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !tier || !amount || typeof isCodeApplied !== 'boolean') {
            return res.status(400).json({ error: 'Missing or invalid required payment details' });
        }

        if (!['basic', 'standard', 'premium'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid subscription tier' });
        }

        // Validate amount based on coupon application
        const planAmounts = {
            basic: 49.00,
            standard: 49.00,
            premium: 199.99,
        };
        const depositFee = 299.00;
        let expectedAmount;
        if (isCodeApplied) {
            expectedAmount = depositFee; // Only deposit fee when coupon is applied
        } else {
            expectedAmount = planAmounts[tier] + depositFee; // Plan fee + deposit fee
        }

        if (amount !== expectedAmount) {
            return res.status(400).json({ error: `Invalid amount for ${tier} plan. Expected ${expectedAmount} INR` });
        }

        // Verify the payment signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.warn(`Payment verification failed for order ${razorpay_order_id}`);
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the user's subscription
        const transactionDate = new Date();
        user.subscription_type = tier;
        user.subscription_validity = new Date(transactionDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days validity
        await user.save();

        // Store the payment details in SubscriptionPayment
        const subscriptionPayment = new SubscriptionPayment({
            transaction_date: transactionDate,
            payment_id: razorpay_payment_id,
            user_id: user.user_id,
            user_email: user.email,
            validity: user.subscription_validity,
            subscription_type: tier,
            amount: amount,
            isCodeApplied: isCodeApplied,
            isActive: true
        });
        await subscriptionPayment.save();

        console.log(`Payment verified and subscription updated for user ${user.user_id}: Plan ${tier}, Coupon Applied: ${isCodeApplied}`);
        res.status(200).json({ message: 'Payment verified and subscription updated successfully' });
    } catch (err) {
        console.error('Error verifying Razorpay payment:', err.message);
        res.status(500).json({ error: `Failed to verify payment: ${err.message}` });
    }
});

// POST /api/users/cancel-subscription - Cancel the user's current subscription
router.post('/cancel-subscription', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            console.log('User not found for cancel-subscription:', req.userId);
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user has an active subscription
        if (!user.subscription_type || user.subscription_type === 'basic') {
            console.log('No active subscription to cancel for user:', user.user_id);
            return res.status(400).json({ error: 'No active subscription to cancel' });
        }

        // Check if subscription is still valid
        const currentDate = new Date();
        if (user.subscription_validity < currentDate) {
            console.log('Subscription already expired for user:', user.user_id);
            return res.status(400).json({ error: 'Subscription is already expired' });
        }

        // Check for dropoff_pending transactions
        const dropoffPendingTransactions = await Transaction.find({
            user_id: user._id,
            status: 'dropoff_pending',
        });
        if (dropoffPendingTransactions.length > 0) {
            console.log('User has dropoff_pending transactions:', user.user_id);
            return res.status(400).json({
                error: 'Please complete your book drop-off before canceling the subscription',
            });
        }

        // Check if the user has a book
        if (user.book_id) {
            console.log('User has a book assigned:', user.book_id, 'user:', user.user_id);
            return res.status(400).json({
                error: 'Please drop off your current book before canceling the subscription',
            });
        }

        // Find the active subscription payment
        const subscriptionPayment = await SubscriptionPayment.findOne({
            user_id: user.user_id,
            isActive: true,
        });
        if (!subscriptionPayment) {
            console.log('No active subscription payment found for user:', user.user_id);
            return res.status(404).json({ error: 'No active subscription payment found' });
        }

        const canceledSubscriptionType = user.subscription_type;

        // Cancel Razorpay subscription (auto-pay)
        if (subscriptionPayment.razorpay_subscription_id) {
            try {
                await razorpay.subscriptions.cancel(subscriptionPayment.razorpay_subscription_id);
                console.log('Razorpay subscription canceled:', subscriptionPayment.razorpay_subscription_id);
            } catch (err) {
                console.error('Failed to cancel Razorpay subscription:', err.message);
                return res.status(500).json({ error: 'Failed to cancel auto-pay subscription' });
            }
        }

        // Initiate refund for the deposit
        if (subscriptionPayment.deposit_payment_id && subscriptionPayment.deposit_amount) {
            try {
                const refund = await razorpay.payments.refund(subscriptionPayment.deposit_payment_id, {
                    amount: subscriptionPayment.deposit_amount * 100, // Convert to paise
                    speed: 'normal', // or 'optimum' for faster refunds
                });
                subscriptionPayment.refund_status = 'processed';
                console.log('Deposit refund initiated:', refund.id, 'for payment:', subscriptionPayment.deposit_payment_id);
            } catch (err) {
                subscriptionPayment.refund_status = 'failed';
                console.error('Failed to refund deposit:', err.message);
                return res.status(500).json({ error: 'Failed to process deposit refund' });
            }
        }

        // Mark subscription as inactive
        subscriptionPayment.isActive = false;
        await subscriptionPayment.save();

        // Update user subscription details
        user.subscription_type = 'basic';
        user.subscription_validity = currentDate;
        await user.save();

        // Cancel any pickup_pending transactions
        const pickupPendingTransactions = await Transaction.find({
            user_id: user._id,
            status: 'pickup_pending',
        });

        for (const transaction of pickupPendingTransactions) {
            // Make the book available again
            const book = await Book.findById(transaction.book_id);
            if (book) {
                book.available = true;
                book.updatedAt = new Date();
                await book.save();
            }
            // Delete the transaction
            await Transaction.deleteOne({ _id: transaction._id });
            console.log('Canceled pickup_pending transaction:', transaction.transaction_id, 'for user:', user.user_id);
        }

        console.log(`Subscription cancelled for user ${user.user_id}: Plan ${canceledSubscriptionType}`);
        res.status(200).json({ message: `Subscription (${canceledSubscriptionType}) cancelled and deposit refund initiated successfully` });
    } catch (err) {
        console.error('Error cancelling subscription:', err.message);
        res.status(500).json({ error: `Failed to cancel subscription: ${err.message}` });
    }
});

module.exports = router;