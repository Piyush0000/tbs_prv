// Add this to your initCoupons.js file or create a new initialization script

const CouponCode = require('./models/CouponCode');

async function initializeSpecialCoupon() {
  try {
    console.log('Initializing special KAVYATHEBOOKSHELVES coupon...');
    
    // Check if the coupon already exists
    const existingCoupon = await CouponCode.findOne({
      code: 'KAVYATHEBOOKSHELVES'
    });

    if (existingCoupon) {
      console.log('KAVYATHEBOOKSHELVES coupon already exists. Updating properties...');
      
      // Update the existing coupon to ensure it has the right properties
      await CouponCode.findOneAndUpdate(
        { code: 'KAVYATHEBOOKSHELVES' },
        {
          description: 'New user special - First month free with autopay setup',
          discount_type: 'percentage',
          discount_value: 100,
          is_active: true,
          usage_limit: null, // unlimited total usage
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          one_per_user: true, // only once per user
          new_users_only: true, // only for new users
          applicable_tiers: ['standard'],
          minimum_amount: 0,
          used_by_users: existingCoupon.used_by_users || [] // preserve existing usage
        },
        { new: true }
      );
      
      console.log('✅ KAVYATHEBOOKSHELVES coupon updated successfully');
    } else {
      // Create new coupon
      const newCoupon = new CouponCode({
        code: 'KAVYATHEBOOKSHELVES',
        description: 'New user special - First month free with autopay setup',
        discount_type: 'percentage',
        discount_value: 100,
        is_active: true,
        usage_limit: null, // unlimited total usage
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        one_per_user: true, // only once per user
        new_users_only: true, // only for new users
        applicable_tiers: ['standard'],
        minimum_amount: 0,
        created_by: 'system',
        times_used: 0,
        used_by_users: []
      });

      await newCoupon.save();
      console.log('✅ KAVYATHEBOOKSHELVES coupon created successfully');
    }

    // Also update the existing sample coupons to have the new structure
    await CouponCode.createSampleCoupons();
    
    return true;
  } catch (error) {
    console.error('❌ Error initializing KAVYATHEBOOKSHELVES coupon:', error);
    return false;
  }
}

// If running this script directly
if (require.main === module) {
  const mongoose = require('mongoose');
  const dotenv = require('dotenv');
  
  dotenv.config();
  
  mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
      console.log('Connected to MongoDB');
      await initializeSpecialCoupon();
      process.exit(0);
    })
    .catch(error => {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    });
}

module.exports = initializeSpecialCoupon;