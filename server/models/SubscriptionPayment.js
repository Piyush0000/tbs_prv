const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema({
  transaction_date: { type: Date, default: Date.now },
  payment_id: { type: String, required: true }, // Razorpay payment ID for the subscription
  deposit_payment_id: { type: String }, // Razorpay payment ID for the deposit
  razorpay_subscription_id: { type: String }, // Razorpay subscription ID for auto-pay
  plan_id: { type: String }, // Razorpay plan ID
  user_id: { type: String, required: true }, // References User.user_id
  user_email: { type: String, required: true },
  validity: { type: Date, required: true }, // Transaction date + 30 days
  subscription_type: { type: String, enum: ['basic', 'standard', 'premium'], required: true },
  amount: { type: Number, required: true }, // Amount in INR for subscription
  deposit_amount: { type: Number }, // Deposit amount in INR
  isCodeApplied: { type: Boolean, default: false }, // Whether coupon was applied
  isActive: { type: Boolean, default: true }, // Whether payment is active
  subscription_status: { type: String, enum: ['created', 'deposit_paid', 'auto_setup_pending', 'active', 'halted', 'cancelled', 'completed', 'expired'], default: 'created' },
  deposit_status: { type: String, enum: ['n/a', 'deposited', 'refunded'], default: 'n/a' },
  cancelled_at: { type: Date }, // Date when subscription was cancelled
});

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);