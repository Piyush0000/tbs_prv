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

// Initialize Razorpay instance for payment processing
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Middleware to verify JWT token and extract user ID
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

// Middleware to ensure the user has admin role
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

// GET /profile: Fetch the authenticated user's profile
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
            deposit_status: user.deposit_status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    } catch (err) {
        console.error('Error fetching user profile:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /: Fetch all users with optional filters (admin only)
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

// GET /filters: Fetch distinct subscription types and roles for filtering (admin only)
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

// GET /:user_id: Fetch a specific user by user_id (admin only)
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

// POST /: Create a new user (admin only)
router.post(
    '/',
    authMiddleware,
    adminMiddleware,
    [
        body('name').notEmpty().withMessage('Name is required').trim(),
        body('email').isEmail().withMessage('Valid email is required').trim(),
        body('phone_number').notEmpty().withMessage('Phone number is required').trim(),
        body('password').notEmpty().withMessage('Password is required'),
        body('subscription_type').optional().isIn(['basic', 'standard', 'premium']).withMessage('Subscription type must be basic, standard, or premium'),
        body('role').optional().isIn(['user', 'admin', 'cafe']).withMessage('Role must be user or admin or cafe'),
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

            if (!user.user_id) {
                console.log('user_id not set by model, generating manually...');
                const count = await User.countDocuments();
                user.user_id = `User_${String(count + 1).padStart(3, '0')}`;
                console.log('Manually generated user_id:', user.user_id);
            }

            let savedUser;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                try {
                    savedUser = await user.save();
                    break;
                } catch (err) {
                    if (err.code === 11000 && err.keyPattern && err.keyPattern.user_id) {
                        attempts++;
                        console.log(`Duplicate user_id detected, retrying (${attempts}/${maxAttempts})...`);
                        const count = await User.countDocuments();
                        user.user_id = `User_${String(count + 1).padStart(3, '0')}`;
                        continue;
                    }
                    throw err;
                }
            }

            if (!savedUser) {
                throw new Error('Failed to save user after multiple attempts due to duplicate user_id');
            }

            // Migrate existing subscription data to new schema for new users
            const existingPayment = await SubscriptionPayment.findOne({ user_id: savedUser.user_id });
            if (existingPayment) {
                savedUser.subscription_type = existingPayment.subscription_type || 'basic';
                savedUser.subscription_validity = existingPayment.validity || new Date();
                savedUser.deposit_status = existingPayment.deposit_status || 'n/a';
                await savedUser.save();
                console.log(`Migrated subscription data for user ${savedUser.user_id}`);
            }

            console.log('User created:', savedUser);
            res.status(201).json({ message: 'User created successfully', user: savedUser });
        } catch (err) {
            console.error('Error creating user:', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// PUT /update-user: Update authenticated user's email or phone number
router.put(
    '/update-user',
    authMiddleware,
    [
        body('email').optional().isEmail().withMessage('Valid email is required'),
        body('phone_number').optional().matches(/^\d{10}$/).withMessage('Phone number must be 10 digits'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { email, phone_number } = req.body;

            if (!email && !phone_number) {
                return res.status(400).json({ message: 'At least one field (email or phone_number) must be provided' });
            }

            const user = await User.findById(req.userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (email && email !== user.email) {
                const existingEmailUser = await User.findOne({ email });
                if (existingEmailUser && existingEmailUser._id.toString() !== req.userId) {
                    return res.status(400).json({ message: 'Email already in use' });
                }
                user.email = email;
            }

            if (phone_number && phone_number !== user.phone_number) {
                const existingPhoneUser = await User.findOne({ phone_number });
                if (existingPhoneUser && existingPhoneUser._id.toString() !== req.userId) {
                    return res.status(400).json({ message: 'Phone number already in use' });
                }
                user.phone_number = phone_number;
            }

            await user.save();
            console.log('User updated:', user);
            return res.status(200).json({ message: 'User updated successfully' });
        } catch (err) {
            console.error('Error updating user:', err.message);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
);

// PUT /:user_id: Update a specific user's details (admin only)
router.put(
    '/:user_id',
    authMiddleware,
    adminMiddleware,
    [
        body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
        body('email').optional().isEmail().withMessage('Valid email is required').trim(),
        body('phone_number').optional().notEmpty().withMessage('Phone number cannot be empty').trim(),
        body('password').optional().notEmpty().withMessage('Password cannot be empty'),
        body('subscription_type').optional().isIn(['basic', 'standard', 'premium']).withMessage('Subscription type must be basic, standard, or premium'),
        body('role').optional().isIn(['user', 'admin', 'cafe']).withMessage('Role must be user or admin or cafe'),
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

            // Migrate existing subscription data if updating subscription-related fields
            if (updates.subscription_type || updates.subscription_validity || updates.deposit_status) {
                const existingPayment = await SubscriptionPayment.findOne({ user_id });
                if (existingPayment) {
                    if (updates.subscription_type) existingPayment.subscription_type = updates.subscription_type;
                    if (updates.subscription_validity) existingPayment.validity = updates.subscription_validity;
                    if (updates.deposit_status) existingPayment.deposit_status = updates.deposit_status;
                    await existingPayment.save();
                    console.log(`Migrated subscription data for user ${user_id} during update`);
                }
            }

            Object.assign(user, updates);
            await user.save();

            console.log('User updated:', user);
            res.status(200).json({ message: 'User updated successfully', user });
        } catch (err) {
            console.error('Error updating user:', err.message);
            res.status(500).json({ error: err.message });
        }
    }
);

// DELETE /:user_id: Delete a specific user (admin only)
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

// POST /create-deposit: Create a Razorpay order for deposit payment
router.post('/create-deposit', authMiddleware, async (req, res) => {
    try {
        const { amount } = req.body;
        if (amount !== 299) {
            return res.status(400).json({ error: 'Invalid deposit amount. Expected ₹299' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const orderOptions = {
            amount: 29900, // ₹299 in paise
            currency: 'INR',
            receipt: `deposit_receipt_${user.user_id}_${Date.now()}`,
            notes: {
                user_id: user.user_id,
                type: 'deposit',
            },
        };

        const order = await razorpay.orders.create(orderOptions);
        console.log(`Razorpay deposit order created for user ${user.user_id}: ${order.id}`);

        res.status(200).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        console.error('Error creating deposit order:', err.message);
        res.status(500).json({ error: `Failed to create deposit order: ${err.message}` });
    }
});

// POST /create-subscription: Create a Razorpay subscription for the user
router.post('/create-subscription', authMiddleware, async (req, res) => {
    try {
        const { tier, amount, isCodeApplied } = req.body;
        if (!['basic', 'standard', 'premium'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid subscription tier' });
        }
        if (amount !== 49) {
            return res.status(400).json({ error: 'Invalid subscription amount. Expected ₹49' });
        }

        const user = await User.findById(req.userId);
        if (!user || user.deposit_status !== 'deposited') {
            return res.status(400).json({ error: 'Deposit payment required first' });
        }

        let planId;
        try {
            const planResponse = await razorpay.plans.create({
                period: 'monthly',
                interval: 1,
                item: {
                    name: 'Standard Plan Monthly',
                    amount: 4900,
                    currency: 'INR',
                    description: 'Monthly subscription for Standard Plan',
                },
            });
            planId = planResponse.id;
            console.log(`Razorpay plan created: ${planId}`);
        } catch (err) {
            if (err.error && err.error.code === 'BAD_REQUEST_ERROR' && err.error.description.includes('already exists')) {
                const plans = await razorpay.plans.all({
                    period: 'monthly',
                    amount: 4900,
                });
                const existingPlan = plans.items.find(p => p.item.amount === 4900 && p.period === 'monthly');
                if (existingPlan) {
                    planId = existingPlan.id;
                    console.log(`Using existing Razorpay plan: ${planId}`);
                } else {
                    throw new Error('No matching plan found');
                }
            } else {
                throw err;
            }
        }

        const subscriptionOptions = {
            plan_id: planId,
            customer_notify: 1,
            total_count: 12,
            start_at: isCodeApplied ? Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000) : undefined,
            notes: {
                user_id: user.user_id,
                tier: tier,
                isCodeApplied: isCodeApplied.toString(),
            },
        };

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);
        console.log(`Razorpay subscription created for user ${user.user_id}: ${subscription.id}`);

        res.status(200).json({
            orderId: subscription.id,
            amount: 4900,
            currency: 'INR',
            key: process.env.RAZORPAY_KEY_ID,
            subscriptionUrl: subscription.short_url,
        });
    } catch (err) {
        console.error('Error creating Razorpay subscription:', err.message);
        res.status(500).json({ error: `Failed to create subscription: ${err.message}` });
    }
});

// POST /verify-deposit-payment: Verify and record a deposit payment
router.post('/verify-deposit-payment', authMiddleware, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

        if (amount !== 299) {
            return res.status(400).json({ error: 'Invalid deposit amount. Expected ₹299' });
        }

        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.warn(`Deposit payment verification failed for order ${razorpay_order_id}`);
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.deposit_status = 'deposited';
        await user.save();

        const subscriptionPayment = new SubscriptionPayment({
            transaction_date: new Date(),
            payment_id: razorpay_payment_id,
            deposit_payment_id: razorpay_payment_id,
            user_id: user.user_id,
            user_email: user.email,
            validity: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000),
            subscription_type: user.subscription_type,
            amount: amount,
            deposit_amount: amount,
            isCodeApplied: false,
            isActive: true,
            subscription_status: 'deposit_paid',
            deposit_status: 'deposited',
        });
        await subscriptionPayment.save();

        console.log(`Deposit payment verified for user ${user.user_id}`);
        res.status(200).json({ message: 'Deposit payment verified and updated successfully' });
    } catch (err) {
        console.error('Error verifying deposit payment:', err.message);
        res.status(500).json({ error: `Failed to verify deposit payment: ${err.message}` });
    }
});

// POST /verify-subscription-payment: Verify and record a subscription payment
router.post('/verify-subscription-payment', authMiddleware, async (req, res) => {
    try {
        const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, tier, amount, isCodeApplied } = req.body;

        if (!['basic', 'standard', 'premium'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid subscription tier' });
        }

        if (amount !== 49) {
            return res.status(400).json({ error: 'Invalid subscription amount. Expected ₹49' });
        }

        // Log received verification data for debugging
        console.log('Received subscription verification data:', {
            razorpay_subscription_id,
            razorpay_payment_id,
            razorpay_signature,
        });

        // Generate signature as per Razorpay subscription authentication
        const body = razorpay_payment_id + '|' + razorpay_subscription_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        // Log signatures for comparison
        console.log('Generated Signature:', expectedSignature);
        console.log('Received Signature:', razorpay_signature);

        if (expectedSignature !== razorpay_signature) {
            console.warn(`Subscription payment verification failed for subscription ${razorpay_subscription_id}`);
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        const user = await User.findById(req.userId);
        if (!user || user.deposit_status !== 'deposited') {
            return res.status(400).json({ error: 'Deposit payment required first' });
        }

        user.subscription_type = tier;
        user.subscription_validity = isCodeApplied 
            ? new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)
            : new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
        await user.save();

        const subscriptionPayment = new SubscriptionPayment({
            transaction_date: new Date(),
            payment_id: razorpay_payment_id,
            razorpay_subscription_id: razorpay_subscription_id,
            user_id: user.user_id,
            user_email: user.email,
            validity: user.subscription_validity,
            subscription_type: tier,
            amount: isCodeApplied ? 0 : amount,
            isCodeApplied: isCodeApplied,
            isActive: true,
            subscription_status: 'active',
            deposit_status: user.deposit_status,
        });
        await subscriptionPayment.save();

        console.log(`Subscription payment verified for user ${user.user_id}: Plan ${tier}, Coupon Applied: ${isCodeApplied}`);
        res.status(200).json({ message: 'Subscription payment verified and updated successfully' });
    } catch (err) {
        console.error('Error verifying subscription payment:', err.message);
        res.status(500).json({ error: `Failed to verify subscription payment: ${err.message}` });
    }
});

// POST /webhook: Handle Razorpay webhook events for subscription updates
router.post('/webhook', async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const receivedSignature = req.headers['x-razorpay-signature'];
        const payload = JSON.stringify(req.body);

        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');

        if (receivedSignature !== expectedSignature) {
            console.warn('Webhook signature verification failed');
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        const event = req.body.event;
        const payloadData = req.body.payload;

        if (event === 'subscription.charged') {
            const subscription = payloadData.subscription.entity;
            const payment = payloadData.payment.entity;

            const subscriptionPayment = await SubscriptionPayment.findOne({ razorpay_subscription_id: subscription.id });
            if (!subscriptionPayment) {
                return res.status(404).json({ error: 'Subscription payment not found' });
            }

            const user = await User.findOne({ user_id: subscriptionPayment.user_id });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            user.subscription_validity = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
            subscriptionPayment.validity = user.subscription_validity;
            subscriptionPayment.payment_id = payment.id;
            subscriptionPayment.transaction_date = new Date();
            subscriptionPayment.amount = payment.amount / 100;
            subscriptionPayment.subscription_status = 'active';

            await user.save();
            await subscriptionPayment.save();

            console.log(`Subscription charged for user ${user.user_id}: ${subscription.id}`);
        } else if (event === 'subscription.cancelled' || event === 'subscription.halted' || event === 'subscription.expired') {
            const subscription = payloadData.subscription.entity;

            const subscriptionPayment = await SubscriptionPayment.findOne({ razorpay_subscription_id: subscription.id });
            if (!subscriptionPayment) {
                return res.status(404).json({ error: 'Subscription payment not found' });
            }

            const user = await User.findOne({ user_id: subscriptionPayment.user_id });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            user.subscription_type = 'basic';
            user.subscription_validity = new Date();
            user.deposit_status = 'refunded';
            subscriptionPayment.isActive = false;
            subscriptionPayment.subscription_status = subscription.status;
            subscriptionPayment.cancelled_at = new Date();

            await user.save();
            await subscriptionPayment.save();

            console.log(`Subscription ${event} for user ${user.user_id}: ${subscription.id}`);
        }

        res.status(200).json({ status: 'ok' });
    } catch (err) {
        console.error('Error processing webhook:', err.message);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// POST /cancel-subscription: Cancel the user's active subscription and process refund
router.post('/cancel-subscription', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            console.log('User not found for cancel-subscription:', req.userId);
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.subscription_type || user.subscription_type === 'basic') {
            console.log('No active subscription to cancel for user:', user.user_id);
            return res.status(400).json({ error: 'No active subscription to cancel' });
        }

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
                subscriptionPayment.deposit_status = 'refunded';
                user.deposit_status = 'refunded';
                console.log('Deposit refund initiated:', refund.id, 'for payment:', subscriptionPayment.deposit_payment_id);
            } catch (err) {
                console.error('Failed to refund deposit:', err.message);
                subscriptionPayment.deposit_status = 'deposited';
                return res.status(500).json({ error: 'Failed to process deposit refund' });
            }
        }

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

        // Update subscription payment
        subscriptionPayment.isActive = false;
        subscriptionPayment.subscription_status = 'cancelled';
        subscriptionPayment.cancelled_at = new Date();
        await subscriptionPayment.save();

        // Update user subscription details
        user.subscription_type = 'basic';
        user.subscription_validity = currentDate;
        await user.save();

        console.log(`Subscription cancelled for user ${user.user_id}: Plan ${canceledSubscriptionType}`);
        res.status(200).json({ message: `Subscription (${canceledSubscriptionType}) cancelled and deposit refund initiated successfully` });
    } catch (err) {
        console.error('Error cancelling subscription:', err.message);
        res.status(500).json({ error: `Failed to cancel subscription: ${err.message}` });
    }
});

// POST /migrate-subscription-data: Migrate subscription data between User and SubscriptionPayment models (admin only)
router.post('/migrate-subscription-data', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find();
        for (const user of users) {
            const subscriptionPayment = await SubscriptionPayment.findOne({ user_id: user.user_id }) || {};

            if (!user.subscription_type && subscriptionPayment.subscription_type) {
                user.subscription_type = subscriptionPayment.subscription_type;
            }
            if (!user.subscription_validity && subscriptionPayment.validity) {
                user.subscription_validity = subscriptionPayment.validity;
            }
            if (!user.deposit_status && subscriptionPayment.deposit_status) {
                user.deposit_status = subscriptionPayment.deposit_status;
            }
            await user.save();
            console.log(`Migrated User data for ${user.user_id}`);

            if (subscriptionPayment) {
                if (!subscriptionPayment.subscription_type) {
                    subscriptionPayment.subscription_type = user.subscription_type || 'basic';
                }
                if (!subscriptionPayment.validity) {
                    subscriptionPayment.validity = user.subscription_validity || new Date();
                }
                if (!subscriptionPayment.deposit_status) {
                    subscriptionPayment.deposit_status = user.deposit_status || 'n/a';
                }
                await subscriptionPayment.save();
                console.log(`Migrated SubscriptionPayment data for ${user.user_id}`);
            } else {
                const newPayment = new SubscriptionPayment({
                    user_id: user.user_id,
                    user_email: user.email,
                    subscription_type: user.subscription_type || 'basic',
                    validity: user.subscription_validity || new Date(),
                    deposit_status: user.deposit_status || 'n/a',
                    isActive: user.subscription_type !== 'basic',
                    subscription_status: user.subscription_type === 'basic' ? 'created' : 'active',
                });
                await newPayment.save();
                console.log(`Created new SubscriptionPayment for ${user.user_id}`);
            }
        }

        console.log('Migration completed for all users');
        res.status(200).json({ message: 'Subscription data migration completed successfully' });
    } catch (err) {
        console.error('Error during migration:', err.message);
        res.status(500).json({ error: `Migration failed: ${err.message}` });
    }
});

module.exports = router;