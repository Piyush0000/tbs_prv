const mongoose = require('mongoose');

console.log('Transaction model loading...');

// Define the Transaction schema
const transactionSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, unique: true },
  book_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Book' },
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  cafe_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Cafe' },
  status: {
    type: String,
    enum: ['pickup_pending', 'picked_up', 'dropoff_pending', 'dropped_off'],
    default: 'pickup_pending',
  },
  created_at: { type: Date, default: Date.now },
  processed_at: { type: Date },
});

// Pre-save hook to auto-generate transaction_id using timestamp and random string
transactionSchema.pre('save', async function (next) {
  console.log('pre-save hook triggered for Transaction, isNew:', this.isNew);
  if (this.isNew && !this.transaction_id) {
    try {
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!isUnique && attempts < maxAttempts) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8); // 6-character random string
        const newTransactionId = `TXN_${timestamp}_${randomStr}`; // ranndom transaction ID

        console.log(`Attempt ${attempts + 1}: Checking uniqueness of transaction_id: ${newTransactionId}`);
        const existingTransaction = await mongoose.models.Transaction.findOne({ transaction_id: newTransactionId });
        if (!existingTransaction) {
          this.transaction_id = newTransactionId;
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        console.error('Failed to generate a unique transaction_id after multiple attempts');
        return next(new Error('Failed to generate a unique transaction_id after multiple attempts'));
      }

      console.log('Generated transaction_id:', this.transaction_id);
    } catch (err) {
      console.error('Error in pre-save hook for transaction_id:', err.message, err.stack);
      return next(new Error(`Failed to generate transaction_id: ${err.message}`));
    }
  }
  next();
});

// Use mongoose.models to prevent model overwrite
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
console.log('Transaction model registered');

module.exports = Transaction;