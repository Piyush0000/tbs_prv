const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema({
  // Transaction Information
  transaction_date: { type: Date, default: Date.now },
  payment_id: { type: String, required: true }, // Razorpay payment ID for the subscription
  deposit_payment_id: { type: String }, // Razorpay payment ID for the deposit
  razorpay_subscription_id: { type: String }, // Razorpay subscription ID for auto-pay
  plan_id: { type: String }, // Razorpay plan ID
  
  // User Information
  user_id: { type: String, required: true }, // References User.user_id
  user_email: { type: String, required: true },
  
  // Subscription Details
  validity: { type: Date, required: true }, // Subscription end date
  subscription_type: { type: String, enum: ['basic', 'standard', 'premium'], required: true },
  amount: { type: Number, required: true }, // Amount paid for subscription in INR
  deposit_amount: { type: Number, default: 0 }, // Deposit amount in INR
  
  // Coupon and Discount Information
  isCodeApplied: { type: Boolean, default: false }, // Whether coupon was applied
  couponCode: { type: String }, // The actual coupon code used
  originalAmount: { type: Number }, // Original amount before discount
  discountAmount: { type: Number, default: 0 }, // Amount saved due to coupon
  
  // Status Information
  isActive: { type: Boolean, default: true }, // Whether payment record is active
  subscription_status: { 
    type: String, 
    enum: [
      'created',           // Initial state when order/subscription is created
      'deposit_paid',      // Only deposit has been paid
      'auto_setup_pending', // Autopay subscription created, waiting for first payment
      'active',            // Subscription is fully active
      'halted',            // Subscription temporarily halted
      'cancelled',         // Subscription cancelled by user
      'completed',         // Subscription completed naturally
      'expired',           // Subscription expired
      'failed'             // Payment failed
    ], 
    default: 'created' 
  },
  deposit_status: { 
    type: String, 
    enum: ['n/a', 'deposited', 'refunded'], 
    default: 'n/a' 
  },
  
  // Payment Method Information
  is_autopay: { type: Boolean, default: false }, // Whether this is an autopay subscription
  next_billing_date: { type: Date }, // For autopay subscriptions
  billing_cycle_count: { type: Number, default: 1 }, // Number of billing cycles completed
  
  // Cancellation Information
  cancelled_at: { type: Date }, // Date when subscription was cancelled
  cancellation_reason: { type: String }, // Reason for cancellation
  refund_initiated: { type: Boolean, default: false },
  refund_amount: { type: Number, default: 0 },
  refund_date: { type: Date },
  
  // Audit Information
  created_by: { type: String, default: 'system' }, // Who created this record
  last_updated_by: { type: String, default: 'system' },
  notes: { type: String }, // Any additional notes
  
  // Metadata
  metadata: {
    razorpay_order_id: String,
    razorpay_signature: String,
    payment_method: String,
    ip_address: String,
    user_agent: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
subscriptionPaymentSchema.index({ user_id: 1, isActive: 1 });
subscriptionPaymentSchema.index({ subscription_status: 1 });
subscriptionPaymentSchema.index({ razorpay_subscription_id: 1 });
subscriptionPaymentSchema.index({ transaction_date: -1 });
subscriptionPaymentSchema.index({ validity: 1 });

// Virtual for checking if subscription is expired
subscriptionPaymentSchema.virtual('isExpired').get(function() {
  return new Date() > this.validity;
});

// Virtual for days remaining
subscriptionPaymentSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diffTime = this.validity - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to handle business logic
subscriptionPaymentSchema.pre('save', function(next) {
  // Auto-update status based on validity
  if (this.validity < new Date() && this.subscription_status === 'active') {
    this.subscription_status = 'expired';
  }
  
  // Set next billing date for autopay subscriptions
  if (this.is_autopay && this.subscription_status === 'active' && !this.next_billing_date) {
    this.next_billing_date = new Date(this.validity.getTime() + (30 * 24 * 60 * 60 * 1000));
  }
  
  // Calculate discount amount if coupon was applied
  if (this.isCodeApplied && this.originalAmount && !this.discountAmount) {
    this.discountAmount = this.originalAmount - this.amount;
  }
  
  // Update last_updated_by
  this.last_updated_by = this.last_updated_by || 'system';
  
  next();
});

// Static method to find active subscription for a user
subscriptionPaymentSchema.statics.findActiveSubscription = function(user_id) {
  return this.findOne({
    user_id,
    isActive: true,
    subscription_status: { $in: ['active', 'auto_setup_pending'] }
  }).sort({ transaction_date: -1 });
};

// Static method to get subscription history for a user
subscriptionPaymentSchema.statics.getUserSubscriptionHistory = function(user_id, limit = 10) {
  return this.find({ user_id })
    .sort({ transaction_date: -1 })
    .limit(limit);
};

// Instance method to cancel subscription
subscriptionPaymentSchema.methods.cancel = function(reason = 'User requested') {
  this.subscription_status = 'cancelled';
  this.cancelled_at = new Date();
  this.cancellation_reason = reason;
  this.isActive = false;
  return this.save();
};

// Instance method to extend validity
subscriptionPaymentSchema.methods.extend = function(days) {
  this.validity = new Date(this.validity.getTime() + (days * 24 * 60 * 60 * 1000));
  if (this.is_autopay) {
    this.next_billing_date = new Date(this.validity.getTime() + (30 * 24 * 60 * 60 * 1000));
  }
  return this.save();
};

// Instance method to initiate refund
subscriptionPaymentSchema.methods.initiateRefund = function(amount, reason = 'Subscription cancellation') {
  this.refund_initiated = true;
  this.refund_amount = amount;
  this.refund_date = new Date();
  this.notes = (this.notes ? this.notes + ' | ' : '') + `Refund initiated: ${reason}`;
  return this.save();
};

// Static method to find expiring subscriptions
subscriptionPaymentSchema.statics.findExpiringSubscriptions = function(daysFromNow = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysFromNow);
  
  return this.find({
    isActive: true,
    subscription_status: 'active',
    validity: { $lte: futureDate, $gte: new Date() }
  });
};

// Static method for admin analytics
subscriptionPaymentSchema.statics.getAnalytics = function(startDate, endDate) {
  const matchStage = {
    transaction_date: { $gte: startDate, $lte: endDate }
  };
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalDeposits: { $sum: '$deposit_amount' },
        totalTransactions: { $sum: 1 },
        activeSubscriptions: {
          $sum: { $cond: [{ $eq: ['$subscription_status', 'active'] }, 1, 0] }
        },
        cancelledSubscriptions: {
          $sum: { $cond: [{ $eq: ['$subscription_status', 'cancelled'] }, 1, 0] }
        },
        autopaySubscriptions: {
          $sum: { $cond: ['$is_autopay', 1, 0] }
        }
      }
    }
  ]);
};

// Static method to sync with User model
subscriptionPaymentSchema.statics.syncWithUser = async function(user_id) {
  const User = mongoose.model('User');
  const activeSubscription = await this.findActiveSubscription(user_id);
  
  if (activeSubscription) {
    const user = await User.findOne({ user_id });
    if (user) {
      let updated = false;
      
      if (user.subscription_type !== activeSubscription.subscription_type) {
        user.subscription_type = activeSubscription.subscription_type;
        updated = true;
      }
      
      if (user.subscription_validity?.getTime() !== activeSubscription.validity?.getTime()) {
        user.subscription_validity = activeSubscription.validity;
        updated = true;
      }
      
      if (user.deposit_status !== activeSubscription.deposit_status) {
        user.deposit_status = activeSubscription.deposit_status;
        updated = true;
      }
      
      if (updated) {
        await user.save();
        console.log(`Synced user ${user_id} with subscription data`);
      }
    }
  }
  
  return activeSubscription;
};

// Post-save middleware to sync with User model
subscriptionPaymentSchema.post('save', async function(doc) {
  if (doc.isActive && doc.subscription_status === 'active') {
    try {
      await this.constructor.syncWithUser(doc.user_id);
    } catch (error) {
      console.error('Error syncing with User model:', error);
    }
  }
});

// Method to check if subscription needs renewal
subscriptionPaymentSchema.methods.needsRenewal = function(daysBefore = 3) {
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + daysBefore);
  return this.validity <= renewalDate && this.subscription_status === 'active';
};

// Export the model
module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);