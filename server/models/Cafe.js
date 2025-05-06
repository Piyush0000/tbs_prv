const mongoose = require('mongoose');

const cafeSchema = new mongoose.Schema({
  cafe_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true }, // Full address
  city: { type: String }, // Parsed city
  area: { type: String }, // Parsed area
  image_url: { type: String },
  gmap_url: { type: String, required: false },
  audio_url: { type: String },
  average_bill: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  ratings: { type: Number, min: 0, max: 5, default: 0 },
  specials: { type: String },
  cafe_owner_id: { type: String, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-save hook to auto-generate cafe_id and parse location
cafeSchema.pre('save', async function (next) {
  // Auto-generate cafe_id
  if (this.isNew) {
    let count = 1;
    let cafe_id = `cafe_${String(count).padStart(3, '0')}`;
    while (await mongoose.models.Cafe.findOne({ cafe_id })) {
      count++;
      cafe_id = `cafe_${String(count).padStart(3, '0')}`;
    }
    this.cafe_id = cafe_id;
  }

  // Parse location into city and area
  /*if (this.location) {
    const parts = this.location.split(',').map((part) => part.trim());
    // Simple heuristic: last part is usually city or state, second-to-last could be area
    if (parts.length > 1) {
      this.city = parts[parts.length - 2] || ''; // e.g., "Chandannagar"
      this.area = parts[parts.length - 3] || ''; // e.g., "Barabazar"
    } else {
      this.city = parts[0] || '';
      this.area = '';
    }
  }*/

  next();
});

// Add text index for efficient searching
cafeSchema.index({ location: 'text', city: 'text', area: 'text' });

module.exports = mongoose.model('Cafe', cafeSchema);