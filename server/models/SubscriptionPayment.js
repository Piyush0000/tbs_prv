const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema({
  transaction_date: { type: Date, default: Date.now },
  payment_id: { type: String, required: true }, // Razorpay payment ID for the subscription
  user_id: { type: String, required: true }, // References User.user_id
  user_email: { type: String, required: true },
  validity: { type: Date, required: true }, // Transaction date + 30 days
  subscription_type: { type: String, enum: ['basic', 'standard', 'premium'], required: true },
  amount: { type: Number, required: true }, // Amount in INR for subscription
  isCodeApplied: { type: Boolean, default: false }, // Whether coupon was applied
  isActive: { type: Boolean, default: true }, // Whether payment is active
  razorpay_subscription_id: { type: String }, // Razorpay subscription ID for auto-pay
  deposit_payment_id: { type: String }, // Razorpay payment ID for the deposit
  deposit_amount: { type: Number }, // Deposit amount in INR
  refund_status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' }, // Refund status for deposit
});

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);