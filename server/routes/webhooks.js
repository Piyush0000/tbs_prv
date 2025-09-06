const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const User = require('../models/User');
const PaymentHistory = require('../models/PaymentHistory');

// Webhook endpoint for Razorpay events
router.post('/razorpay', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Invalid webhook signature received');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body.toString());
    logger.info(`Webhook received: ${event.event} for ${event.payload.subscription?.entity || event.payload.payment?.entity}`);

    switch (event.event) {
      case 'subscription.charged':
        await handleSubscriptionCharged(event.payload.subscription.entity, event.payload.payment.entity);
        break;
      
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(event.payload.subscription.entity);
        break;
      
      case 'subscription.completed':
        await handleSubscriptionCompleted(event.payload.subscription.entity);
        break;
      
      case 'subscription.paused':
        await handleSubscriptionPaused(event.payload.subscription.entity);
        break;
      
      case 'subscription.resumed':
        await handleSubscriptionResumed(event.payload.subscription.entity);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      
      default:
        logger.info(`Unhandled webhook event: ${event.event}`);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    logger.error(`Webhook processing error: ${error.message}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleSubscriptionCharged(subscription, payment) {
  try {
    const user = await User.findOne({ razorpay_subscription_id: subscription.id });
    if (!user) {
      logger.warn(`User not found for subscription: ${subscription.id}`);
      return;
    }

    // Update subscription validity (extend by 1 month)
    const currentValidity = user.subscription_validity || new Date();
    const newValidity = new Date(Math.max(currentValidity.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);
    
    user.subscription_validity = newValidity;
    user.updatedAt = new Date();
    await user.save();

    // Record payment in history
    const paymentHistory = new PaymentHistory({
      user_id: user._id,
      razorpay_payment_id: payment.id,
      razorpay_subscription_id: subscription.id,
      amount: payment.amount / 100, // Convert from paise
      currency: payment.currency,
      type: 'subscription',
      status: 'completed',
      tier: user.subscription_type,
      completed_at: new Date()
    });

    await paymentHistory.save();

    logger.info(`Subscription charged successfully for user: ${user.user_id}, amount: ${payment.amount / 100}`);

  } catch (error) {
    logger.error(`Error handling subscription charged: ${error.message}`);
  }
}

async function handleSubscriptionCancelled(subscription) {
  try {
    const user = await User.findOne({ razorpay_subscription_id: subscription.id });
    if (!user) {
      logger.warn(`User not found for cancelled subscription: ${subscription.id}`);
      return;
    }

    user.subscription_cancelled_at = new Date();
    user.razorpay_subscription_id = null;
    user.updatedAt = new Date();
    await user.save();

    // Record cancellation
    const paymentHistory = new PaymentHistory({
      user_id: user._id,
      razorpay_subscription_id: subscription.id,
      type: 'subscription_cancellation',
      status: 'completed',
      completed_at: new Date()
    });

    await paymentHistory.save();

    logger.info(`Subscription cancelled for user: ${user.user_id}`);

  } catch (error) {
    logger.error(`Error handling subscription cancelled: ${error.message}`);
  }
}

async function handleSubscriptionCompleted(subscription) {
  try {
    const user = await User.findOne({ razorpay_subscription_id: subscription.id });
    if (!user) {
      logger.warn(`User not found for completed subscription: ${subscription.id}`);
      return;
    }

    user.subscription_type = null;
    user.razorpay_subscription_id = null;
    user.subscription_completed_at = new Date();
    user.updatedAt = new Date();
    await user.save();

    logger.info(`Subscription completed for user: ${user.user_id}`);

  } catch (error) {
    logger.error(`Error handling subscription completed: ${error.message}`);
  }
}

async function handleSubscriptionPaused(subscription) {
  try {
    const user = await User.findOne({ razorpay_subscription_id: subscription.id });
    if (!user) {
      logger.warn(`User not found for paused subscription: ${subscription.id}`);
      return;
    }

    user.subscription_paused_at = new Date();
    user.updatedAt = new Date();
    await user.save();

    logger.info(`Subscription paused for user: ${user.user_id}`);

  } catch (error) {
    logger.error(`Error handling subscription paused: ${error.message}`);
  }
}

async function handleSubscriptionResumed(subscription) {
  try {
    const user = await User.findOne({ razorpay_subscription_id: subscription.id });
    if (!user) {
      logger.warn(`User not found for resumed subscription: ${subscription.id}`);
      return;
    }

    user.subscription_paused_at = null;
    user.updatedAt = new Date();
    await user.save();

    logger.info(`Subscription resumed for user: ${user.user_id}`);

  } catch (error) {
    logger.error(`Error handling subscription resumed: ${error.message}`);
  }
}

async function handlePaymentFailed(payment) {
  try {
    // Find the payment history record and mark it as failed
    const paymentHistory = await PaymentHistory.findOne({ 
      razorpay_payment_id: payment.id 
    });

    if (paymentHistory) {
      await paymentHistory.markFailed(payment.error_description);
      logger.info(`Payment marked as failed: ${payment.id}`);
    }

    // If it's a subscription payment failure, we might want to notify the user
    // or take other actions based on your business logic

  } catch (error) {
    logger.error(`Error handling payment failed: ${error.message}`);
  }
}

module.exports = router;