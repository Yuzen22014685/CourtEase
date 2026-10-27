const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const PlatformSettings = require('../models/PlatformSettings');
const CommissionStatement = require('../models/CommissionStatement');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const { computeMonthlyStats, monthRange, currentMonthMY, MONTH_RE } = require('../utils/insights');
const { getOwnedVenueIds, canAccessVenue } = require('../utils/venueAccess');

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Generate a statement payment reference: "CS-" + 6 alphanumeric characters
 */
const generateStatementRef = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CS-${code}`;
};

/**
 * Helper to safely unlink an image from the uploads directory
 */
const unlinkUploadFile = (fileUrl) => {
  if (!fileUrl) return;
  if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('uploads/')) {
    const filename = path.basename(fileUrl);
    const filePath = path.join(__dirname, '..', 'uploads', filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Failed to unlink uploaded file:', err.message);
      }
    }
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/commission/payment-info (Admin + Owner)
// ---------------------------------------------------------------------------
const getPaymentInfo = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.json({
      success: true,
      data: {
        commissionRate: settings.commissionRate,
        includeAddOns: settings.includeAddOns,
        paymentInfo: settings.paymentInfo || {
          duitNowQr: '',
          bankName: '',
          accountName: '',
          accountNumber: '',
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/commission/settings (Admin only)
// ---------------------------------------------------------------------------
const getSettings = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/commission/settings (Admin only)
// ---------------------------------------------------------------------------
const updateSettings = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    const { commissionRate, includeAddOns, bankName, accountName, accountNumber } = req.body || {};

    if (commissionRate !== undefined) {
      const rateNum = Number(commissionRate);
      if (
        typeof commissionRate !== 'number' &&
        (typeof commissionRate !== 'string' || commissionRate.trim() === '')
      ) {
        return res.status(400).json({
          success: false,
          message: 'commissionRate must be a number between 0 and 30 with at most 2 decimal places',
        });
      }
      if (
        isNaN(rateNum) ||
        rateNum < 0 ||
        rateNum > 30 ||
        Math.round(rateNum * 100) !== rateNum * 100
      ) {
        return res.status(400).json({
          success: false,
          message: 'commissionRate must be a number between 0 and 30 with at most 2 decimal places',
        });
      }
      settings.commissionRate = rateNum;
    }

    if (includeAddOns !== undefined) {
      if (typeof includeAddOns !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'includeAddOns must be a boolean',
        });
      }
      settings.includeAddOns = includeAddOns;
    }

    // Payment bank fields
    settings.paymentInfo = settings.paymentInfo || {};

    if (bankName !== undefined) {
      const bn = typeof bankName === 'string' ? bankName.trim() : '';
      if (bn.length > 60) {
        return res.status(400).json({ success: false, message: 'Bank name cannot exceed 60 characters' });
      }
      settings.paymentInfo.bankName = bn;
    }

    if (accountName !== undefined) {
      const an = typeof accountName === 'string' ? accountName.trim() : '';
      if (an.length > 80) {
        return res.status(400).json({ success: false, message: 'Account name cannot exceed 80 characters' });
      }
      settings.paymentInfo.accountName = an;
    }

    if (accountNumber !== undefined) {
      const acc = typeof accountNumber === 'string' ? accountNumber.trim() : '';
      if (acc.length > 30) {
        return res.status(400).json({ success: false, message: 'Account number cannot exceed 30 characters' });
      }
      if (!/^[0-9\s-]*$/.test(acc)) {
        return res.status(400).json({
          success: false,
          message: 'Account number must contain only digits, spaces, and dashes',
        });
      }
      settings.paymentInfo.accountNumber = acc;
    }

    await settings.save();
    res.json({ success: true, message: 'Settings updated successfully', data: settings });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/commission/settings/qr (Admin only)
// ---------------------------------------------------------------------------
const uploadPlatformQr = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No QR image uploaded' });
    }

    settings.paymentInfo = settings.paymentInfo || {};
    const oldQr = settings.paymentInfo.duitNowQr;
    unlinkUploadFile(oldQr);

    settings.paymentInfo.duitNowQr = '/uploads/' + req.file.filename;
    await settings.save();

    res.json({
      success: true,
      duitNowQr: settings.paymentInfo.duitNowQr,
      data: settings.paymentInfo,
    });
  } catch (err) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/admin/commission/settings/qr (Admin only)
// ---------------------------------------------------------------------------
const deletePlatformQr = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    settings.paymentInfo = settings.paymentInfo || {};
    const oldQr = settings.paymentInfo.duitNowQr;
    unlinkUploadFile(oldQr);

    settings.paymentInfo.duitNowQr = '';
    await settings.save();

    res.json({
      success: true,
      message: 'Platform QR removed successfully',
      data: settings.paymentInfo,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/commission/statements/generate (Admin only)
// ---------------------------------------------------------------------------
const generateStatements = async (req, res, next) => {
  try {
    const { month } = req.body || {};
    if (!month || !MONTH_RE.test(month)) {
      return res.status(400).json({ success: false, message: 'Month must be YYYY-MM' });
    }

    if (month >= currentMonthMY()) {
      return res.status(400).json({
        success: false,
        message: 'Statements can only be generated for finished months',
      });
    }

    const settings = await PlatformSettings.getSettings();
    const venues = await Venue.find().select('name operatingHours numberOfCourts');

    const { start, endExclusive } = monthRange(month);
    const bookings = await Booking.find({
      date: { $gte: start, $lt: endExclusive },
    })
      .select('venueId date startTime endTime amount items itemsTotal status paymentStatus confirmedAt')
      .lean();

    const bookingsByVenue = new Map();
    for (const b of bookings) {
      const vid = String(b.venueId);
      if (!bookingsByVenue.has(vid)) {
        bookingsByVenue.set(vid, []);
      }
      bookingsByVenue.get(vid).push(b);
    }

    let created = 0;
    let skippedExisting = 0;
    let noRevenue = 0;

    for (const venue of venues) {
      const existing = await CommissionStatement.findOne({ venueId: venue._id, month });
      if (existing) {
        skippedExisting++;
        continue;
      }

      const vBookings = bookingsByVenue.get(String(venue._id)) || [];
      const s = computeMonthlyStats(vBookings, [venue], month);
      const base = s.revenue.court + (settings.includeAddOns ? s.revenue.shop : 0);
      const amountDue = round2((base * settings.commissionRate) / 100);

      if (amountDue <= 0) {
        noRevenue++;
        continue;
      }

      const createData = {
        venueId: venue._id,
        month,
        courtRevenue: s.revenue.court,
        shopRevenue: s.revenue.shop,
        base,
        rate: settings.commissionRate,
        includeAddOns: settings.includeAddOns,
        amountDue,
        confirmedSessions: s.bookings.confirmed,
        status: 'unpaid',
      };

      let ref = generateStatementRef();
      try {
        await CommissionStatement.create({ ...createData, paymentRef: ref });
        created++;
      } catch (err) {
        if (err.code === 11000) {
          const isVenueMonthDup =
            (err.keyPattern && err.keyPattern.venueId && err.keyPattern.month) ||
            (err.message && err.message.includes('venueId_1_month_1'));
          if (isVenueMonthDup) {
            skippedExisting++;
            continue;
          }

          const isPaymentRefDup =
            (err.keyPattern && err.keyPattern.paymentRef) ||
            (err.message && err.message.includes('paymentRef'));
          if (isPaymentRefDup) {
            try {
              ref = generateStatementRef();
              await CommissionStatement.create({ ...createData, paymentRef: ref });
              created++;
            } catch (retryErr) {
              if (retryErr.code === 11000) {
                const retryVenueMonth =
                  (retryErr.keyPattern && retryErr.keyPattern.venueId && retryErr.keyPattern.month) ||
                  (retryErr.message && retryErr.message.includes('venueId_1_month_1'));
                if (retryVenueMonth) {
                  skippedExisting++;
                  continue;
                }
              }
              throw retryErr;
            }
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    res.json({ success: true, month, created, skippedExisting, noRevenue });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/commission/statements (Admin + Owner)
// ---------------------------------------------------------------------------
const listStatements = async (req, res, next) => {
  try {
    const { month, status, venueId } = req.query || {};
    const baseFilter = {};

    if (req.user.role === 'venue_owner') {
      const ownedIds = await getOwnedVenueIds(req.user);
      if (venueId) {
        const hasMatch = ownedIds.some((id) => id.toString() === String(venueId));
        if (!hasMatch) {
          return res.status(403).json({ success: false, message: 'You do not have access to this venue' });
        }
        baseFilter.venueId = venueId;
      } else {
        baseFilter.venueId = { $in: ownedIds };
      }
    } else if (venueId) {
      baseFilter.venueId = venueId;
    }

    if (month && MONTH_RE.test(month)) {
      baseFilter.month = month;
    }

    // Status counts for the current scope (before status filter)
    const [unpaid, submitted, paid] = await Promise.all([
      CommissionStatement.countDocuments({ ...baseFilter, status: 'unpaid' }),
      CommissionStatement.countDocuments({ ...baseFilter, status: 'submitted' }),
      CommissionStatement.countDocuments({ ...baseFilter, status: 'paid' }),
    ]);

    const filter = { ...baseFilter };
    if (status && ['unpaid', 'submitted', 'paid'].includes(status)) {
      filter.status = status;
    }

    const statements = await CommissionStatement.find(filter)
      .populate('venueId', 'name area')
      .populate('verifiedBy', 'fullName email')
      .sort({ month: -1 });

    // Secondary sort by venue name
    statements.sort((a, b) => {
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      const nameA = a.venueId?.name || '';
      const nameB = b.venueId?.name || '';
      return nameA.localeCompare(nameB);
    });

    res.json({
      success: true,
      data: statements,
      counts: { unpaid, submitted, paid },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/commission/statements/submitted-count (Admin only)
// ---------------------------------------------------------------------------
const submittedCount = async (req, res, next) => {
  try {
    const count = await CommissionStatement.countDocuments({ status: 'submitted' });
    res.json({ success: true, count });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Middleware: loadOwnStatementForUpload (runs BEFORE multer)
// ---------------------------------------------------------------------------
const loadOwnStatementForUpload = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Statement not found' });
    }

    const statement = await CommissionStatement.findById(req.params.id);
    if (!statement) {
      return res.status(404).json({ success: false, message: 'Statement not found' });
    }

    if (req.user.role !== 'venue_owner') {
      return res.status(403).json({
        success: false,
        message: 'Only venue owners may upload commission payment receipts',
      });
    }

    const hasAccess = await canAccessVenue(req.user, statement.venueId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this venue statement',
      });
    }

    if (statement.status !== 'unpaid') {
      return res.status(409).json({
        success: false,
        message: 'This statement is already submitted or paid',
      });
    }

    req.statement = statement;
    next();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/commission/statements/:id/receipt (Owner only)
// ---------------------------------------------------------------------------
const uploadStatementReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No receipt image uploaded' });
    }

    // Atomic status transition from 'unpaid'
    const updated = await CommissionStatement.findOneAndUpdate(
      { _id: req.statement._id, status: 'unpaid' },
      {
        $set: {
          receiptImage: '/uploads/' + req.file.filename,
          status: 'submitted',
          submittedAt: new Date(),
          rejectionReason: null,
        },
      },
      { returnDocument: 'after' }
    ).populate('venueId', 'name area');

    if (!updated) {
      // Race: clean up uploaded file if already submitted/paid
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
      return res.status(409).json({
        success: false,
        message: 'This statement is already submitted or paid',
      });
    }

    // If there was an old receipt on file, unlink it
    if (req.statement.receiptImage) {
      unlinkUploadFile(req.statement.receiptImage);
    }

    res.json({
      success: true,
      message: 'Receipt uploaded successfully',
      data: updated,
    });
  } catch (err) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/commission/statements/:id/verify (Admin only)
// ---------------------------------------------------------------------------
const verifyStatement = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Statement not found' });
    }

    const updated = await CommissionStatement.findOneAndUpdate(
      { _id: req.params.id, status: 'submitted' },
      {
        $set: {
          status: 'paid',
          verifiedAt: new Date(),
          verifiedBy: req.user._id,
        },
      },
      { returnDocument: 'after' }
    )
      .populate('venueId', 'name area')
      .populate('verifiedBy', 'fullName email');

    if (!updated) {
      const exists = await CommissionStatement.findById(req.params.id);
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Statement not found' });
      }
      return res.status(409).json({
        success: false,
        message: 'This statement is no longer awaiting verification',
      });
    }

    res.json({
      success: true,
      message: 'Statement verified and marked as paid',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/commission/statements/:id/reject (Admin only)
// ---------------------------------------------------------------------------
const rejectStatement = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Statement not found' });
    }

    const { reason } = req.body || {};
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

    if (!trimmedReason || trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required (minimum 5 characters)',
      });
    }

    const updated = await CommissionStatement.findOneAndUpdate(
      { _id: req.params.id, status: 'submitted' },
      {
        $set: {
          status: 'unpaid',
          rejectionReason: trimmedReason.slice(0, 300),
        },
      },
      { returnDocument: 'after' }
    ).populate('venueId', 'name area');

    if (!updated) {
      const exists = await CommissionStatement.findById(req.params.id);
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Statement not found' });
      }
      return res.status(409).json({
        success: false,
        message: 'This statement is no longer awaiting verification',
      });
    }

    res.json({
      success: true,
      message: 'Statement rejected',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPaymentInfo,
  getSettings,
  updateSettings,
  uploadPlatformQr,
  deletePlatformQr,
  generateStatements,
  listStatements,
  submittedCount,
  loadOwnStatementForUpload,
  uploadStatementReceipt,
  verifyStatement,
  rejectStatement,
};
