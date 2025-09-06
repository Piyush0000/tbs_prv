// Enhanced payments.js with KAVYATHEBOOKSHELVES coupon support

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const User = require('../models/User');
const CouponCode = require('../models/CouponCode');
const PaymentHistory = require('../models/PaymentHistory');
const SubscriptionPayment = require('../models/SubscriptionPayment'); // Added this import
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Enhanced logging for debugging
const debugLog = (message, data = {}) => {
  console.log(`[PAYMENT DEBUG] ${message}`, data);
  logger.info(`[PAYMENT DEBUG] ${message}`, data);
};

// Initialize Razorpay with enhanced error handling
let razorpay;
try {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not found in environment variables');
  }
  
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  
  debugLog('Razorpay initialized successfully');
} catch (error) {
  console.error('Failed to initialize Razorpay:', error.message);
  logger.error('Failed to initialize Razorpay:', error.message);
}

// Enhanced auth middleware with better error handling
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    debugLog('Auth middleware called', { hasAuthHeader: !!authHeader });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      debugLog('No valid authorization header found');
      return res.status(401).json({ error: 'Unauthorized - No valid token provided' });
    }

    const token = authHeader.split(' ')[1];
    debugLog('Token extracted', { tokenLength: token.length });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    debugLog('Token verified successfully', { userId: req.userId });
    
    next();
  } catch (err) {
    debugLog('Token verification failed', { error: err.message });
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper function to check if user is new (never had subscription)
const isNewUser = async (userId) => {
  try {
    // Check SubscriptionPayment records for any past activity
    const existingSubscription = await SubscriptionPayment.findOne({
      user_id: userId,
      subscription_status: { $in: ['active', 'completed', 'expired'] }
    });

    if (existingSubscription) {
      debugLog('User has existing subscription history', { userId, subscriptionId: existingSubscription._id });
      return false;
    }

    // Also check User model for subscription history
    const user = await User.findById(userId);
    if (user && user.subscription_type && user.subscription_type !== 'none') {
      // Check if they ever had an active subscription in the past
      const hasSubscriptionHistory = await SubscriptionPayment.findOne({
        user_id: userId,
        subscription_status: { $ne: 'created' }
      });

      if (hasSubscriptionHistory) {
        debugLog('User has subscription payment history', { userId });
        return false;
      }
    }

    debugLog('User is confirmed as new user', { userId });
    return true;
  } catch (error) {
    debugLog('Error checking new user status', { userId, error: error.message });
    return false; // Err on the side of caution
  }
};

// POST /api/payments/create-deposit-order - Without transactions
router.post('/create-deposit-order', authMiddleware, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required')
], async (req, res) => {
  debugLog('Create deposit order endpoint called', { 
    userId: req.userId, 
    body: req.body,
    headers: Object.keys(req.headers)
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    debugLog('Validation errors', { errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Check if Razorpay is initialized
    if (!razorpay) {
      debugLog('Razorpay not initialized');
      return res.status(500).json({ error: 'Payment gateway not initialized' });
    }

    // Find user - no session needed
    const user = await User.findById(req.userId);
    if (!user) {
      debugLog('User not found', { userId: req.userId });
      return res.status(404).json({ error: 'User not found' });
    }

    debugLog('User found', { 
      userId: user.user_id, 
      depositStatus: user.deposit_status,
      email: user.email 
    });

    // Check if deposit already paid
    if (user.deposit_status === 'deposited') {
      debugLog('Deposit already paid', { userId: user.user_id });
      return res.status(400).json({ error: 'Deposit already paid' });
    }

    const { amount } = req.body;
    const amountInPaise = Math.round(amount * 100);

    debugLog('Creating Razorpay order', { amount, amountInPaise });

    // Create Razorpay order with enhanced error handling
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `deposit_${user.user_id}_${Date.now()}`,
      payment_capture: 1
    };

    debugLog('Razorpay order options', options);

    let order;
    try {
      order = await razorpay.orders.create(options);
      debugLog('Razorpay order created successfully', { orderId: order.id });
    } catch (razorpayError) {
      debugLog('Razorpay order creation failed', { 
        error: razorpayError.message,
        statusCode: razorpayError.statusCode,
        description: razorpayError.error?.description
      });
      
      return res.status(500).json({ 
        error: 'Failed to create payment order',
        details: razorpayError.error?.description || razorpayError.message
      });
    }

    // Save payment intent in database - no session
    const paymentHistory = new PaymentHistory({
      user_id: user._id,
      razorpay_order_id: order.id,
      amount: amount,
      currency: 'INR',
      type: 'deposit',
      status: 'created',
      receipt: options.receipt
    });

    await paymentHistory.save();
    debugLog('Payment history saved', { paymentHistoryId: paymentHistory._id });

    res.status(200).json({
      orderId: order.id,
      amount: amountInPaise,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    debugLog('Unexpected error in create-deposit-order', { 
      error: err.message,
      stack: err.stack 
    });
    
    logger.error(`Error creating deposit order: ${err.message}`, { stack: err.stack });
    res.status(500).json({ 
      error: 'Failed to create deposit order',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Add the missing endpoint for verifying deposit payment
router.post('/verify-deposit-payment', authMiddleware, [
  body('razorpay_payment_id').notEmpty().withMessage('Payment ID is required'),
  body('razorpay_order_id').notEmpty().withMessage('Order ID is required'),
  body('razorpay_signature').notEmpty().withMessage('Signature is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required')
], async (req, res) => {
  debugLog('Verify deposit payment endpoint called', { 
    userId: req.userId, 
    body: { ...req.body, razorpay_signature: '[HIDDEN]' }
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    debugLog('Validation errors', { errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      debugLog('Payment signature verification failed');
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Find user
    const user = await User.findById(req.userId);
    if (!user) {
      debugLog('User not found', { userId: req.userId });
      return res.status(404).json({ error: 'User not found' });
    }

    // Find payment history record
    const paymentHistory = await PaymentHistory.findOne({ 
      razorpay_order_id: razorpay_order_id,
      user_id: user._id 
    });

    if (!paymentHistory) {
      debugLog('Payment history not found', { orderId: razorpay_order_id });
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Update payment history
    await paymentHistory.markCompleted({
      razorpay_payment_id,
      razorpay_signature
    });

    // Update user deposit status
    user.deposit_status = 'deposited';
    user.updatedAt = new Date();
    await user.save();

    debugLog('Deposit payment verified successfully', { 
      userId: user.user_id,
      paymentId: razorpay_payment_id 
    });

    res.status(200).json({
      message: 'Deposit payment verified successfully',
      user: {
        user_id: user.user_id,
        deposit_status: user.deposit_status
      }
    });

  } catch (err) {
    debugLog('Unexpected error in verify-deposit-payment', { 
      error: err.message,
      stack: err.stack 
    });
    
    logger.error(`Error verifying deposit payment: ${err.message}`, { stack: err.stack });
    res.status(500).json({ 
      error: 'Failed to verify deposit payment',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// UPDATED: Enhanced coupon validation with KAVYATHEBOOKSHELVES support
router.post('/validate-coupon', authMiddleware, [
  body('code').notEmpty().withMessage('Coupon code is required')
], async (req, res) => {
  debugLog('Validate coupon endpoint called', { 
    userId: req.userId, 
    code: req.body.code 
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    debugLog('Validation errors', { errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { code } = req.body;
    const upperCode = code.toUpperCase();

    // Find user first
    const user = await User.findById(req.userId);
    if (!user) {
      debugLog('User not found for coupon validation', { userId: req.userId });
      return res.status(404).json({ 
        valid: false, 
        error: 'User not found' 
      });
    }

    // Find coupon
    const coupon = await CouponCode.findOne({ code: upperCode });
    if (!coupon) {
      debugLog('Coupon not found', { code: upperCode });
      return res.status(404).json({ 
        valid: false, 
        error: 'Coupon code not found' 
      });
    }

    // Check if coupon is valid
    if (!coupon.isValid()) {
      debugLog('Coupon invalid', { 
        code: upperCode, 
        isActive: coupon.is_active,
        expired: coupon.expires_at < new Date(),
        usageLimitReached: coupon.usage_limit && coupon.times_used >= coupon.usage_limit
      });
      return res.status(400).json({ 
        valid: false, 
        error: 'Coupon code is expired or not valid' 
      });
    }

    // NEW: Check if user can use this coupon (for one_per_user coupons)
    if (coupon.one_per_user && coupon.canUserUseCoupon) {
      const canUseResult = coupon.canUserUseCoupon(user.user_id || user._id.toString());
      if (!canUseResult.canUse) {
        debugLog('User cannot use coupon', { 
          code: upperCode, 
          userId: user.user_id,
          reason: canUseResult.reason 
        });
        return res.status(400).json({ 
          valid: false, 
          error: canUseResult.reason 
        });
      }
    }

    // NEW: Special validation for new users only coupons
    if (coupon.new_users_only) {
      const userIsNew = await isNewUser(req.userId);
      if (!userIsNew) {
        debugLog('Coupon is for new users only', { 
          code: upperCode, 
          userId: user.user_id 
        });
        return res.status(400).json({ 
          valid: false, 
          error: 'This coupon is only available for new users' 
        });
      }
    }

    // NEW: For KAVYATHEBOOKSHELVES specifically, double-check user eligibility
    if (upperCode === 'KAVYATHEBOOKSHELVES') {
      // Check if user has already used this specific coupon
      const alreadyUsed = coupon.used_by_users && coupon.used_by_users.some(
        usage => usage.user_id === (user.user_id || user._id.toString())
      );
      
      if (alreadyUsed) {
        debugLog('KAVYATHEBOOKSHELVES already used by user', { 
          userId: user.user_id 
        });
        return res.status(400).json({ 
          valid: false, 
          error: 'You have already used this coupon code' 
        });
      }

      // Verify user is truly new
      const userIsNew = await isNewUser(req.userId);
      if (!userIsNew) {
        debugLog('KAVYATHEBOOKSHELVES not valid for existing user', { 
          userId: user.user_id 
        });
        return res.status(400).json({ 
          valid: false, 
          error: 'This coupon is only available for first-time subscribers' 
        });
      }
    }

    debugLog('Coupon validated successfully', { 
      code: upperCode, 
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      onePerUser: coupon.one_per_user,
      newUsersOnly: coupon.new_users_only
    });

    res.status(200).json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        minimum_amount: coupon.minimum_amount,
        one_per_user: coupon.one_per_user,
        new_users_only: coupon.new_users_only
      }
    });

  } catch (err) {
    debugLog('Unexpected error in validate-coupon', { 
      error: err.message,
      stack: err.stack 
    });
    
    logger.error(`Error validating coupon: ${err.message}`, { stack: err.stack });
    res.status(500).json({ 
      error: 'Failed to validate coupon',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// UPDATED: Enhanced subscription order creation with KAVYATHEBOOKSHELVES support
router.post('/create-subscription-order', authMiddleware, [
  body('tier').isIn(['basic', 'standard', 'premium']).withMessage('Valid tier is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required')
], async (req, res) => {
  debugLog('Create subscription order endpoint called', { 
    userId: req.userId, 
    body: req.body
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    debugLog('Validation errors', { errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { tier, amount, coupon_code } = req.body;

    // Find user
    const user = await User.findById(req.userId);
    if (!user) {
      debugLog('User not found', { userId: req.userId });
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if deposit is paid
    if (user.deposit_status !== 'deposited') {
      debugLog('Deposit not paid', { userId: user.user_id });
      return res.status(400).json({ error: 'Deposit must be paid first' });
    }

    let finalAmount = amount;
    let appliedCoupon = null;

    // ENHANCED: Validate and apply coupon if provided
    if (coupon_code) {
      const coupon = await CouponCode.findOne({ code: coupon_code.toUpperCase() });
      if (!coupon || !coupon.isValid()) {
        debugLog('Invalid coupon provided', { code: coupon_code });
        return res.status(400).json({ error: 'Invalid or expired coupon' });
      }

      // Check if user can use this coupon
      if (coupon.one_per_user && coupon.canUserUseCoupon) {
        const canUseResult = coupon.canUserUseCoupon(user.user_id || user._id.toString());
        if (!canUseResult.canUse) {
          debugLog('User cannot use coupon for subscription', { 
            code: coupon_code,
            reason: canUseResult.reason 
          });
          return res.status(400).json({ error: canUseResult.reason });
        }
      }

      // Check new users only restriction
      if (coupon.new_users_only) {
        const userIsNew = await isNewUser(req.userId);
        if (!userIsNew) {
          debugLog('New users only coupon used by existing user', { 
            code: coupon_code,
            userId: user.user_id 
          });
          return res.status(400).json({ 
            error: 'This coupon is only available for new users' 
          });
        }
      }

      const discount = coupon.calculateDiscount(amount);
      finalAmount = Math.max(0, amount - discount);
      appliedCoupon = coupon;
      
      debugLog('Coupon applied', { 
        code: coupon.code, 
        originalAmount: amount,
        discount: discount,
        finalAmount: finalAmount
      });
    }

    // ENHANCED: Handle free subscription (including KAVYATHEBOOKSHELVES)
    if (finalAmount === 0) {
      // Create SubscriptionPayment record
      const subscriptionPayment = new SubscriptionPayment({
        user_id: user.user_id || user._id.toString(),
        user_email: user.email,
        subscription_type: tier,
        amount: finalAmount,
        validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isCodeApplied: !!appliedCoupon,
        subscription_status: 'active',
        payment_id: `FREE_${Date.now()}_${user.user_id || user._id}`,
        transaction_date: new Date()
      });

      await subscriptionPayment.save();
      debugLog('Free subscription payment record created', { 
        subscriptionPaymentId: subscriptionPayment._id 
      });

      // Update user subscription
      user.subscription_type = tier;
      user.subscription_validity = subscriptionPayment.validity;
      user.updatedAt = new Date();
      await user.save();

      // Create payment history record
      const paymentHistory = new PaymentHistory({
        user_id: user._id,
        amount: finalAmount,
        original_amount: amount,
        discount_amount: appliedCoupon ? appliedCoupon.calculateDiscount(amount) : 0,
        currency: 'INR',
        type: 'subscription',
        status: 'completed',
        tier: tier,
        coupon_code: appliedCoupon?.code || null,
        completed_at: new Date()
      });

      await paymentHistory.save();

      // Mark coupon as used
      if (appliedCoupon) {
        if (appliedCoupon.markAsUsedByUser) {
          appliedCoupon.markAsUsedByUser(user.user_id || user._id.toString());
        } else {
          appliedCoupon.times_used += 1;
        }
        await appliedCoupon.save();
        
        debugLog('Coupon marked as used', { 
          code: appliedCoupon.code,
          userId: user.user_id,
          timesUsed: appliedCoupon.times_used
        });
      }

      // SPECIAL: For KAVYATHEBOOKSHELVES, set up autopay for next month
      if (appliedCoupon && appliedCoupon.code === 'KAVYATHEBOOKSHELVES') {
        try {
          debugLog('Setting up autopay for KAVYATHEBOOKSHELVES user', { userId: user.user_id });
          
          // Create a simple plan for recurring payments
          const planId = `plan_${tier}_monthly_${user.user_id}`.substring(0, 50); // Razorpay ID limit
          
          // Create subscription for next month (starting 30 days from now)
          const subscriptionOptions = {
            plan_id: planId, // You'll need to create this plan in Razorpay dashboard
            customer_notify: 1,
            start_at: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
            total_count: 12, // 12 months
            notes: {
              user_id: user.user_id || user._id.toString(),
              email: user.email,
              coupon_used: 'KAVYATHEBOOKSHELVES',
              original_free_month: new Date().toISOString()
            }
          };

          // Note: You'll need to create the plan first in Razorpay
          // For now, we'll just log that autopay should be set up
          debugLog('Autopay setup required', { 
            planId,
            userId: user.user_id,
            startAt: new Date(subscriptionOptions.start_at * 1000)
          });

          // Update subscription record with note about autopay
          await SubscriptionPayment.findByIdAndUpdate(subscriptionPayment._id, {
            $set: {
              notes: 'KAVYATHEBOOKSHELVES - Free first month with autopay setup required'
            }
          });

        } catch (autopayError) {
          debugLog('Failed to set up autopay', { 
            error: autopayError.message,
            userId: user.user_id
          });
          // Don't fail the free subscription, just log the error
        }
      }

      debugLog('Free subscription activated successfully', { 
        userId: user.user_id, 
        tier: tier,
        couponCode: appliedCoupon?.code
      });

      return res.status(200).json({
        message: `Free subscription activated successfully! ${appliedCoupon?.code === 'KAVYATHEBOOKSHELVES' ? 'Autopay will begin next month.' : ''}`,
        subscriptionId: subscriptionPayment._id,
        validity: subscriptionPayment.validity,
        autopay_setup: appliedCoupon?.code === 'KAVYATHEBOOKSHELVES',
        user: {
          user_id: user.user_id,
          subscription_type: user.subscription_type,
          subscription_validity: user.subscription_validity
        }
      });
    }

    // For paid subscriptions, create Razorpay subscription
    if (!razorpay) {
      debugLog('Razorpay not initialized');
      return res.status(500).json({ error: 'Payment gateway not initialized' });
    }

    // Create subscription plan (for demo, we'll create a simple order instead)
    const finalAmountInPaise = Math.round(finalAmount * 100);
    
    const options = {
      amount: finalAmountInPaise,
      currency: 'INR',
      receipt: `subscription_${user.user_id}_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);
    
    // Save payment intent
    const paymentHistory = new PaymentHistory({
      user_id: user._id,
      razorpay_order_id: order.id,
      amount: finalAmount,
      original_amount: amount,
      discount_amount: appliedCoupon ? appliedCoupon.calculateDiscount(amount) : 0,
      currency: 'INR',
      type: 'subscription',
      status: 'created',
      tier: tier,
      coupon_code: appliedCoupon?.code || null,
      receipt: options.receipt
    });

    await paymentHistory.save();

    debugLog('Subscription order created', { 
      orderId: order.id,
      amount: finalAmount,
      tier: tier
    });

    res.status(200).json({
      subscriptionId: order.id, // Using order ID as subscription ID for simplicity
      amount: finalAmountInPaise,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    debugLog('Unexpected error in create-subscription-order', { 
      error: err.message,
      stack: err.stack 
    });
    
    logger.error(`Error creating subscription order: ${err.message}`, { stack: err.stack });
    res.status(500).json({ 
      error: 'Failed to create subscription order',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// POST /api/payments/verify-subscription-payment
router.post('/verify-subscription-payment', authMiddleware, [
  body('razorpay_payment_id').notEmpty().withMessage('Payment ID is required'),
  body('razorpay_subscription_id').notEmpty().withMessage('Subscription ID is required'),
  body('razorpay_signature').notEmpty().withMessage('Signature is required'),
  body('tier').isIn(['basic', 'standard', 'premium']).withMessage('Valid tier is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required')
], async (req, res) => {
  debugLog('Verify subscription payment endpoint called', { 
    userId: req.userId, 
    body: { ...req.body, razorpay_signature: '[HIDDEN]' }
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    debugLog('Validation errors', { errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { 
      razorpay_payment_id, 
      razorpay_subscription_id, 
      razorpay_signature,
      tier,
      amount 
    } = req.body;

    // Verify signature (using subscription ID as order ID for verification)
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_subscription_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      debugLog('Subscription payment signature verification failed');
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Find user
    const user = await User.findById(req.userId);
    if (!user) {
      debugLog('User not found', { userId: req.userId });
      return res.status(404).json({ error: 'User not found' });
    }

    // Find payment history record
    const paymentHistory = await PaymentHistory.findOne({ 
      razorpay_order_id: razorpay_subscription_id, // We used order ID as subscription ID
      user_id: user._id 
    });

    if (!paymentHistory) {
      debugLog('Payment history not found', { subscriptionId: razorpay_subscription_id });
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Update payment history
    await paymentHistory.markCompleted({
      razorpay_payment_id,
      razorpay_signature
    });

    // Create SubscriptionPayment record
    const subscriptionPayment = new SubscriptionPayment({
      user_id: user.user_id || user._id.toString(),
      user_email: user.email,
      subscription_type: tier,
      amount: amount,
      validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isCodeApplied: !!paymentHistory.coupon_code,
      subscription_status: 'active',
      payment_id: razorpay_payment_id,
      transaction_date: new Date()
    });

    await subscriptionPayment.save();

    // Update user subscription
    user.subscription_type = tier;
    user.subscription_validity = subscriptionPayment.validity;
    user.updatedAt = new Date();
    await user.save();

    // Update coupon usage if coupon was applied
    if (paymentHistory.coupon_code) {
      const coupon = await CouponCode.findOne({ code: paymentHistory.coupon_code });
      if (coupon) {
        if (coupon.markAsUsedByUser) {
          coupon.markAsUsedByUser(user.user_id || user._id.toString());
        } else {
          coupon.times_used += 1;
        }
        await coupon.save();
        
        debugLog('Coupon usage updated for paid subscription', { 
          code: coupon.code,
          userId: user.user_id,
          timesUsed: coupon.times_used
        });
      }
    }

    debugLog('Subscription payment verified successfully', { 
      userId: user.user_id,
      tier: tier,
      paymentId: razorpay_payment_id 
    });

    res.status(200).json({
      message: 'Subscription activated successfully',
      user: {
        user_id: user.user_id,
        subscription_type: user.subscription_type,
        subscription_validity: user.subscription_validity
      }
    });

  } catch (err) {
    debugLog('Unexpected error in verify-subscription-payment', { 
      error: err.message,
      stack: err.stack 
    });
    
    logger.error(`Error verifying subscription payment: ${err.message}`, { stack: err.stack });
    res.status(500).json({ 
      error: 'Failed to verify subscription payment',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Health check endpoint for payments
router.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    razorpay: {
      initialized: !!razorpay,
      keyId: !!process.env.RAZORPAY_KEY_ID,
      keySecret: !!process.env.RAZORPAY_KEY_SECRET
    },
    mongodb: {
      connected: mongoose.connection.readyState === 1
    }
  };
  
  debugLog('Health check requested', health);
  res.status(200).json(health);
});

// Test endpoint to verify Razorpay connection
router.post('/test-razorpay', authMiddleware, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ error: 'Razorpay not initialized' });
    }

    // Try to fetch a non-existent order to test API connection
    try {
      await razorpay.orders.fetch('test_order_id');
    } catch (error) {
      // This should fail with a specific error, which means API is working
      if (error.statusCode === 400 && error.error.code === 'BAD_REQUEST_ERROR') {
        return res.status(200).json({ 
          status: 'Razorpay API connection working',
          message: 'API responded as expected' 
        });
      }
    }

    res.status(500).json({ error: 'Unexpected Razorpay API response' });

  } catch (err) {
    debugLog('Razorpay test failed', { error: err.message });
    res.status(500).json({ error: 'Failed to test Razorpay connection' });
  }
});

// NEW: Admin endpoint to check coupon usage stats
router.get('/admin/coupon-stats/:code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    
    // This should have admin authentication in production
    const coupon = await CouponCode.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    const stats = {
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      times_used: coupon.times_used,
      usage_limit: coupon.usage_limit,
      is_active: coupon.is_active,
      expires_at: coupon.expires_at,
      one_per_user: coupon.one_per_user,
      new_users_only: coupon.new_users_only,
      used_by_users: coupon.used_by_users || [],
      created_at: coupon.createdAt,
      updated_at: coupon.updatedAt
    };

    debugLog('Coupon stats requested', { code: coupon.code, timesUsed: coupon.times_used });
    res.json(stats);

  } catch (err) {
    debugLog('Error fetching coupon stats', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch coupon stats' });
  }
});

// NEW: Endpoint to manually create KAVYATHEBOOKSHELVES coupon (admin only)
router.post('/admin/create-special-coupon', authMiddleware, async (req, res) => {
  try {
    // In production, add proper admin authentication here
    
    const existingCoupon = await CouponCode.findOne({ code: 'KAVYATHEBOOKSHELVES' });
    
    if (existingCoupon) {
      // Update existing coupon
      await CouponCode.findOneAndUpdate(
        { code: 'KAVYATHEBOOKSHELVES' },
        {
          description: 'New user special - First month free with autopay setup',
          discount_type: 'percentage',
          discount_value: 100,
          is_active: true,
          usage_limit: null,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          one_per_user: true,
          new_users_only: true,
          applicable_tiers: ['standard'],
          minimum_amount: 0
        }
      );
      
      debugLog('KAVYATHEBOOKSHELVES coupon updated');
      res.json({ message: 'KAVYATHEBOOKSHELVES coupon updated successfully' });
    } else {
      // Create new coupon
      const newCoupon = new CouponCode({
        code: 'KAVYATHEBOOKSHELVES',
        description: 'New user special - First month free with autopay setup',
        discount_type: 'percentage',
        discount_value: 100,
        is_active: true,
        usage_limit: null,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        one_per_user: true,
        new_users_only: true,
        applicable_tiers: ['standard'],
        minimum_amount: 0,
        created_by: 'admin',
        times_used: 0,
        used_by_users: []
      });

      await newCoupon.save();
      
      debugLog('KAVYATHEBOOKSHELVES coupon created');
      res.json({ message: 'KAVYATHEBOOKSHELVES coupon created successfully' });
    }

  } catch (err) {
    debugLog('Error creating special coupon', { error: err.message });
    res.status(500).json({ error: 'Failed to create special coupon' });
  }
});

module.exports = router;