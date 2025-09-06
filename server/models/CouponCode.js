const mongoose = require('mongoose');

const couponCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  discount_type: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  discount_value: {
    type: Number,
    required: true,
    min: 0
  },
  is_active: {
    type: Boolean,
    default: true
  },
  usage_limit: {
    type: Number,
    default: null // null means unlimited
  },
  times_used: {
    type: Number,
    default: 0
  },
  expires_at: {
    type: Date,
    required: true
  },
  created_by: {
    type: String,
    default: 'admin'
  },
  applicable_tiers: [{
    type: String,
    enum: ['basic', 'standard', 'premium'],
    default: ['standard']
  }],
  minimum_amount: {
    type: Number,
    default: 0
  },
  // NEW: Track which users have used this coupon
  used_by_users: [{
    user_id: {
      type: String,
      required: true
    },
    used_at: {
      type: Date,
      default: Date.now
    }
  }],
  // NEW: Special flag for one-per-user coupons
  one_per_user: {
    type: Boolean,
    default: false
  },
  // NEW: Flag for new user only coupons
  new_users_only: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient querying
couponCodeSchema.index({ code: 1, is_active: 1, expires_at: 1 });
couponCodeSchema.index({ expires_at: 1 });
couponCodeSchema.index({ 'used_by_users.user_id': 1 });

// Method to check if coupon is valid
couponCodeSchema.methods.isValid = function() {
  return this.is_active && 
         this.expires_at > new Date() && 
         (this.usage_limit === null || this.times_used < this.usage_limit);
};

// NEW: Method to check if user can use this coupon
couponCodeSchema.methods.canUserUseCoupon = function(userId) {
  if (!this.isValid()) {
    return { canUse: false, reason: 'Coupon is invalid or expired' };
  }

  // Check if it's a one-per-user coupon and user has already used it
  if (this.one_per_user) {
    const alreadyUsed = this.used_by_users.some(usage => usage.user_id === userId);
    if (alreadyUsed) {
      return { canUse: false, reason: 'You have already used this coupon' };
    }
  }

  return { canUse: true, reason: null };
};

// NEW: Method to mark coupon as used by a user
couponCodeSchema.methods.markAsUsedByUser = function(userId) {
  if (this.one_per_user && !this.used_by_users.some(usage => usage.user_id === userId)) {
    this.used_by_users.push({ user_id: userId });
    this.times_used += 1;
  } else if (!this.one_per_user) {
    this.times_used += 1;
  }
};

// Method to calculate discount
couponCodeSchema.methods.calculateDiscount = function(amount) {
  if (!this.isValid()) {
    return 0;
  }

  if (amount < this.minimum_amount) {
    return 0;
  }

  let discount = 0;
  if (this.discount_type === 'percentage') {
    discount = amount * (this.discount_value / 100);
  } else if (this.discount_type === 'fixed') {
    discount = Math.min(this.discount_value, amount);
  }

  return Math.round(discount * 100) / 100; // Round to 2 decimal places
};

// Static method to create sample coupons
couponCodeSchema.statics.createSampleCoupons = async function() {
  const sampleCoupons = [
    {
      code: 'DINKY100',
      description: 'First month free - Dinky special offer',
      discount_type: 'percentage',
      discount_value: 100,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      usage_limit: 100
    },
    {
      code: 'KAVYA100',
      description: 'First month free - Kavya special offer',
      discount_type: 'percentage',
      discount_value: 100,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      usage_limit: 100
    },
    {
      code: 'LEO100',
      description: 'First month free - Leo special offer',
      discount_type: 'percentage',
      discount_value: 100,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      usage_limit: 100
    },
    {
      code: 'KASIS100',
      description: 'First month free - Kasis special offer',
      discount_type: 'percentage',
      discount_value: 100,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      usage_limit: 100
    },
    // NEW: The special kavyathebookshelves coupon
    {
      code: 'KAVYATHEBOOKSHELVES',
      description: 'New user special - First month free with autopay setup',
      discount_type: 'percentage',
      discount_value: 100,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      usage_limit: null, // unlimited total usage
      one_per_user: true, // but only once per user
      new_users_only: true // only for new users
    }
  ];

  try {
    for (const couponData of sampleCoupons) {
      const existingCoupon = await this.findOne({ code: couponData.code });
      if (!existingCoupon) {
        await this.create(couponData);
        console.log(`Created coupon: ${couponData.code}`);
      } else {
        // Update existing coupon if it's the special one
        if (couponData.code === 'KAVYATHEBOOKSHELVES') {
          await this.findOneAndUpdate(
            { code: couponData.code },
            {
              one_per_user: true,
              new_users_only: true,
              discount_value: 100
            }
          );
          console.log(`Updated special coupon: ${couponData.code}`);
        }
      }
    }
  } catch (error) {
    console.error('Error creating sample coupons:', error);
  }
};

module.exports = mongoose.model('CouponCode', couponCodeSchema);