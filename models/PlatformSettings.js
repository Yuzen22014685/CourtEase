const mongoose = require('mongoose');

const paymentInfoSchema = new mongoose.Schema({
  duitNowQr: { type: String, default: '' },
  bankName: { type: String, default: '', trim: true },
  accountName: { type: String, default: '', trim: true },
  accountNumber: { type: String, default: '', trim: true },
}, { _id: false });

const platformSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'platform', unique: true },
  commissionRate: { type: Number, default: 5, min: 0, max: 30 },
  includeAddOns: { type: Boolean, default: false },
  paymentInfo: {
    type: paymentInfoSchema,
    default: () => ({ duitNowQr: '', bankName: '', accountName: '', accountNumber: '' }),
  },
}, { timestamps: true });

platformSettingsSchema.statics.getSettings = async function () {
  return await this.findOneAndUpdate(
    { key: 'platform' },
    { $setOnInsert: { key: 'platform' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
