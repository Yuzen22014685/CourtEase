const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
  venueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200,
    default: '',
  },
  category: {
    type: String,
    enum: ['product', 'service'],
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    max: 1000,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  photo: {
    type: String,
    default: null,
  },
  notePrompt: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },
  readyInfo: {
    type: String,
    trim: true,
    maxlength: 60,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('ShopItem', shopItemSchema);
