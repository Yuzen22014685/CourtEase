const mongoose = require('mongoose');
const { signUploadPath } = require('../utils/signedUrl');

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

// Receipt images are private: API responses carry a short-lived signed URL, never the raw path.
commissionStatementSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.receiptImage) ret.receiptImage = signUploadPath(ret.receiptImage);
    return ret;
  },
});

module.exports = mongoose.model('CommissionStatement', commissionStatementSchema);
