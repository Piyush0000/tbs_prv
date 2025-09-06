const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Razorpay IDs
  razorpay_payment_id: {
    type: String,
    default: null
  },
  razorpay_order_id: {
    type: String,
    default: null
  },
  razorpay_subscription_id: {
    type: String,
    default: null
  },
  razorpay_plan_id: {
    type: String,
    default: null
  },
  razorpay_signature: {
    type: String,
    default: null
  },

  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  type: {
    type: String,
    required: true,
    enum: ['deposit', 'subscription', 'subscription_cancellation', 'refund']
  },
  status: {
    type: String,
    required: true,
    enum: ['created', 'pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'created'
  },

  // Subscription specific fields
  tier: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    default: null
  },

  // Coupon related fields
  coupon_code: {
    type: String,
    default: null,
    uppercase: true
  },
  original_amount: {
    type: Number,
    default: null
  },
  discount_amount: {
    type: Number,
    default: 0
  },

  // Timestamps
  completed_at: {
    type: Date,
    default: null
  },
  failed_at: {
    type: Date,
    default: null
  },

  // Additional info
  receipt: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null
  },
  failure_reason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
paymentHistorySchema.index({ user_id: 1, type: 1 });
paymentHistorySchema.index({ razorpay_payment_id: 1 });
paymentHistorySchema.index({ razorpay_order_id: 1 });
paymentHistorySchema.index({ razorpay_subscription_id: 1 });
paymentHistorySchema.index({ status: 1, createdAt: -1 });

// Method to mark payment as completed
paymentHistorySchema.methods.markCompleted = function(paymentDetails = {}) {
  this.status = 'completed';
  this.completed_at = new Date();
  
  if (paymentDetails.razorpay_payment_id) {
    this.razorpay_payment_id = paymentDetails.razorpay_payment_id;
  }
  if (paymentDetails.razorpay_signature) {
    this.razorpay_signature = paymentDetails.razorpay_signature;
  }
  
  return this.save();
};

// Method to mark payment as failed
paymentHistorySchema.methods.markFailed = function(reason = null) {
  this.status = 'failed';
  this.failed_at = new Date();
  if (reason) {
    this.failure_reason = reason;
  }
  return this.save();
};

// Method to calculate final amount after discount
paymentHistorySchema.methods.getFinalAmount = function() {
  if (this.original_amount && this.discount_amount) {
    return this.original_amount - this.discount_amount;
  }
  return this.amount;
};

// Static method to find payments by user
paymentHistorySchema.statics.findByUser = function(userId, options = {}) {
  const query = { user_id: userId };
  
  if (options.type) {
    query.type = options.type;
  }
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Static method to get payment statistics
paymentHistorySchema.statics.getStats = function(userId) {
  return this.aggregate([
    { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

module.exports = mongoose.model('PaymentHistory', paymentHistorySchema);