const mongoose = require('mongoose');

const commissionStatementSchema = new mongoose.Schema({
  venueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true,
    index: true,
  },
  month: {
    type: String,
    required: true,
    trim: true,
  },
  courtRevenue: {
    type: Number,
    required: true,
  },
  shopRevenue: {
    type: Number,
    required: true,
  },
  base: {
    type: Number,
    required: true,
  },
  rate: {
    type: Number,
    required: true,
  },
  includeAddOns: {
    type: Boolean,
    required: true,
  },
  amountDue: {
    type: Number,
    required: true,
  },
  confirmedSessions: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['unpaid', 'submitted', 'paid'],
    default: 'unpaid',
    index: true,
  },
  paymentRef: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },
  receiptImage: {
    type: String,
    default: null,
  },
  submittedAt: {
    type: Date,
    default: null,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  rejectionReason: {
    type: String,
    default: null,
    trim: true,
  },
}, { timestamps: true });

commissionStatementSchema.index({ venueId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('CommissionStatement', commissionStatementSchema);
