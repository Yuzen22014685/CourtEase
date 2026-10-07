const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Court = require('../models/Court');
const Review = require('../models/Review');
const User = require('../models/User');
const ShopItem = require('../models/ShopItem');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse "HH:MM" into total minutes since midnight
 */
const toMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

/**
 * Compute average rating and count from Review collection for one or many venues
 */
const computeVenueRatings = async (venueIds) => {
  const agg = await Review.aggregate([
    { $match: { venueId: { $in: venueIds }, isHidden: { $ne: true } } },
    { $group: { _id: '$venueId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const row of agg) {
    map.set(row._id.toString(), {
      avg: Math.round(row.avg * 10) / 10,
      count: row.count,
    });
  }
  return map;
};

// ---------------------------------------------------------------------------
// GET /api/admin/venues
// Returns all venues (both active and inactive) with ratings
// ---------------------------------------------------------------------------
const getAdminVenues = async (req, res, next) => {
  try {
    const query = req.user.role === 'venue_owner' ? { ownerId: req.user._id } : {};
    const venues = await Venue.find(query).sort({ createdAt: -1 }).select('-__v -reviews');
    const ids = venues.map((v) => v._id);
    const ratingMap = await computeVenueRatings(ids);

    let ownerMap = new Map();
    if (req.user.role === 'admin') {
      const ownerIds = [...new Set(venues.map((v) => v.ownerId).filter(Boolean))];
      if (ownerIds.length > 0) {
        const owners = await User.find({ _id: { $in: ownerIds } })
          .select('_id fullName email')
          .lean();
        for (const o of owners) {
          ownerMap.set(o._id.toString(), {
            _id: o._id,
            fullName: o.fullName,
            email: o.email,
          });
        }
      }
    }

    const data = venues.map((v) => {
      const plain = v.toObject();
      const r = ratingMap.get(v._id.toString());
      plain.rating = r ? r.avg : null;
      plain.reviewCount = r ? r.count : 0;
      if (req.user.role === 'admin') {
        plain.owner = plain.ownerId ? (ownerMap.get(plain.ownerId.toString()) || null) : null;
      }
      return plain;
    });

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/venues
// Create a venue and its courts (1..N)
// ---------------------------------------------------------------------------
const createVenue = async (req, res, next) => {
  try {
    const {
      name,
      area,
      address,
      description,
      phone,
      operatingHours,
      pricePerHour,
      numberOfCourts,
      facilities,
      photos,
      isActive,
      location,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Venue name is required' });
    }
    if (!area || !area.trim()) {
      return res.status(400).json({ success: false, message: 'Area is required' });
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ success: false, message: 'Address is required' });
    }

    // Operating hours validation
    if (!operatingHours || !operatingHours.open || !operatingHours.close) {
      return res.status(400).json({ success: false, message: 'Opening and closing hours are required' });
    }
    const openMin = toMinutes(operatingHours.open);
    const closeMin = toMinutes(operatingHours.close);
    if (openMin === null || closeMin === null) {
      return res.status(400).json({ success: false, message: 'Operating hours must be in valid HH:MM format' });
    }
    if (closeMin <= openMin) {
      return res.status(400).json({ success: false, message: 'Closing time must be after opening time' });
    }

    // Price validation
    const price = Number(pricePerHour);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, message: 'Price per hour must be greater than 0' });
    }

    // Number of courts validation (1..20)
    const courtCount = parseInt(numberOfCourts, 10);
    if (isNaN(courtCount) || courtCount < 1 || courtCount > 20) {
      return res.status(400).json({ success: false, message: 'Number of courts must be between 1 and 20' });
    }

    // Description validation
    if (description && description.length > 1000) {
      return res.status(400).json({ success: false, message: 'Description cannot exceed 1000 characters' });
    }

    // Location validation (optional)
    let parsedLocation = undefined;
    if (location && (location.lat !== '' && location.lat !== undefined || location.lng !== '' && location.lng !== undefined)) {
      const lat = Number(location.lat);
      const lng = Number(location.lng);
      if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Latitude must be between -90 and 90, and longitude between -180 and 180',
        });
      }
      parsedLocation = { lat, lng };
    }

    // Clean facilities
    const cleanedFacilities = Array.isArray(facilities)
      ? facilities.map((f) => (typeof f === 'string' ? f.trim() : '')).filter(Boolean)
      : [];

    const venue = await Venue.create({
      name: name.trim(),
      area: area.trim(),
      address: address.trim(),
      description: description ? description.trim() : '',
      phone: phone ? phone.trim() : '',
      operatingHours: {
        open: operatingHours.open.trim(),
        close: operatingHours.close.trim(),
      },
      pricePerHour: price,
      numberOfCourts: courtCount,
      facilities: cleanedFacilities,
      photos: Array.isArray(photos) ? photos : [],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      location: parsedLocation,
    });

    // Create Court documents 1..N
    const courtDocs = [];
    for (let n = 1; n <= courtCount; n++) {
      courtDocs.push({
        venueId: venue._id,
        courtNumber: n,
        status: 'active',
      });
    }
    await Court.insertMany(courtDocs);

    res.status(201).json({ success: true, data: venue });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/venues/:id
// Update venue details. numberOfCourts may only INCREASE.
// ---------------------------------------------------------------------------
const updateVenue = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    delete req.body.ownerId;

    if (req.user.role === 'venue_owner') {
      delete req.body.isActive;
      delete req.body.rating;
      delete req.body.reviews;
    }

    const {
      name,
      area,
      address,
      description,
      phone,
      operatingHours,
      pricePerHour,
      numberOfCourts,
      facilities,
      isActive,
      location,
    } = req.body;

    // Validate and process court count change
    if (numberOfCourts !== undefined && numberOfCourts !== null) {
      const courtCount = parseInt(numberOfCourts, 10);
      if (isNaN(courtCount) || courtCount < 1 || courtCount > 20) {
        return res.status(400).json({ success: false, message: 'Number of courts must be between 1 and 20' });
      }
      if (courtCount < venue.numberOfCourts) {
        return res.status(400).json({
          success: false,
          message: 'Courts cannot be removed because they may have bookings.',
        });
      }
      if (courtCount > venue.numberOfCourts) {
        // Create extra court documents
        const extraCourts = [];
        for (let n = venue.numberOfCourts + 1; n <= courtCount; n++) {
          extraCourts.push({
            venueId: venue._id,
            courtNumber: n,
            status: 'active',
          });
        }
        await Court.insertMany(extraCourts);
        venue.numberOfCourts = courtCount;
      }
    }

    // Operating hours
    if (operatingHours) {
      const open = operatingHours.open ?? venue.operatingHours.open;
      const close = operatingHours.close ?? venue.operatingHours.close;
      const openMin = toMinutes(open);
      const closeMin = toMinutes(close);
      if (openMin === null || closeMin === null) {
        return res.status(400).json({ success: false, message: 'Operating hours must be in valid HH:MM format' });
      }
      if (closeMin <= openMin) {
        return res.status(400).json({ success: false, message: 'Closing time must be after opening time' });
      }
      venue.operatingHours = { open: open.trim(), close: close.trim() };
    }

    // Price
    if (pricePerHour !== undefined) {
      const price = Number(pricePerHour);
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ success: false, message: 'Price per hour must be greater than 0' });
      }
      venue.pricePerHour = price;
    }

    // Name, Area, Address
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ success: false, message: 'Venue name cannot be empty' });
      venue.name = name.trim();
    }
    if (area !== undefined) {
      if (!area.trim()) return res.status(400).json({ success: false, message: 'Area cannot be empty' });
      venue.area = area.trim();
    }
    if (address !== undefined) {
      if (!address.trim()) return res.status(400).json({ success: false, message: 'Address cannot be empty' });
      venue.address = address.trim();
    }

    // Description
    if (description !== undefined) {
      if (description && description.length > 1000) {
        return res.status(400).json({ success: false, message: 'Description cannot exceed 1000 characters' });
      }
      venue.description = description ? description.trim() : '';
    }

    // Phone
    if (phone !== undefined) {
      venue.phone = phone ? phone.trim() : '';
    }

    // Facilities
    if (facilities !== undefined) {
      venue.facilities = Array.isArray(facilities)
        ? facilities.map((f) => (typeof f === 'string' ? f.trim() : '')).filter(Boolean)
        : [];
    }

    // isActive
    if (isActive !== undefined) {
      venue.isActive = Boolean(isActive);
    }

    // Location
    if (location !== undefined) {
      if (
        location === null ||
        (location.lat === '' || location.lat === undefined) &&
        (location.lng === '' || location.lng === undefined)
      ) {
        venue.location = undefined;
      } else {
        const lat = Number(location.lat);
        const lng = Number(location.lng);
        if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
          return res.status(400).json({
            success: false,
            message: 'Latitude must be between -90 and 90, and longitude between -180 and 180',
          });
        }
        venue.location = { lat, lng };
      }
    }

    // paymentInfo text fields (bankName, accountName, accountNumber)
    if (req.body.paymentInfo !== undefined) {
      const pi = req.body.paymentInfo;
      if (typeof pi !== 'object' || pi === null) {
        return res.status(400).json({ success: false, message: 'paymentInfo must be an object' });
      }
      venue.paymentInfo = venue.paymentInfo || {};

      if (pi.bankName !== undefined) {
        const bn = typeof pi.bankName === 'string' ? pi.bankName.trim() : '';
        if (bn && bn.length > 60) {
          return res.status(400).json({ success: false, message: 'Bank name cannot exceed 60 characters' });
        }
        venue.paymentInfo.bankName = bn;
      }

      if (pi.accountName !== undefined) {
        const an = typeof pi.accountName === 'string' ? pi.accountName.trim() : '';
        if (an && an.length > 80) {
          return res.status(400).json({ success: false, message: 'Account name cannot exceed 80 characters' });
        }
        venue.paymentInfo.accountName = an;
      }

      if (pi.accountNumber !== undefined) {
        const acc = typeof pi.accountNumber === 'string' ? pi.accountNumber.trim() : '';
        if (acc) {
          if (acc.length > 30) {
            return res.status(400).json({ success: false, message: 'Account number cannot exceed 30 characters' });
          }
          if (!/^[0-9\s-]+$/.test(acc)) {
            return res.status(400).json({
              success: false,
              message: 'Account number must contain only digits, spaces, and dashes',
            });
          }
        }
        venue.paymentInfo.accountNumber = acc;
      }
    }

    await venue.save();
    res.json({ success: true, data: venue });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/venues/:id/photos
// Upload up to 5 photos per request, max 10 photos total per venue
// ---------------------------------------------------------------------------
const uploadVenuePhotos = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      // Clean up uploaded files if venue not found
      if (req.files && req.files.length > 0) {
        req.files.forEach((f) => {
          try { fs.unlinkSync(f.path); } catch (e) {}
        });
      }
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files uploaded' });
    }

    const currentCount = venue.photos?.length || 0;
    if (currentCount + req.files.length > 10) {
      // Clean up newly uploaded files
      req.files.forEach((f) => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
      return res.status(400).json({
        success: false,
        message: `Maximum 10 photos allowed per venue. This venue currently has ${currentCount} photo(s).`,
      });
    }

    const newPaths = req.files.map((f) => '/uploads/' + f.filename);
    venue.photos = [...(venue.photos || []), ...newPaths];
    await venue.save();

    res.json({ success: true, data: venue.photos });
  } catch (err) {
    if (req.files && req.files.length > 0) {
      req.files.forEach((f) => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
    }
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/admin/venues/:id/photos
// Remove a single photo from venue and disk if it is a local upload
// ---------------------------------------------------------------------------
const deleteVenuePhoto = async (req, res, next) => {
  try {
    const { photo } = req.body;
    if (!photo) {
      return res.status(400).json({ success: false, message: 'Photo path is required' });
    }

    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    if (!venue.photos || !venue.photos.includes(photo)) {
      return res.status(404).json({ success: false, message: 'Photo not found on venue' });
    }

    // Delete local file if it's stored in uploads
    if (photo.startsWith('/uploads/') || photo.startsWith('uploads/')) {
      const filename = path.basename(photo);
      const filePath = path.join(__dirname, '..', 'uploads', filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to unlink venue photo from disk:', e.message);
        }
      }
    }

    venue.photos = venue.photos.filter((p) => p !== photo);
    await venue.save();

    res.json({ success: true, data: venue.photos });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/venues/:id/photos/order
// Reorder photos array for a venue (first photo = cover)
// ---------------------------------------------------------------------------
const reorderVenuePhotos = async (req, res, next) => {
  try {
    const { photos } = req.body;
    if (!Array.isArray(photos)) {
      return res.status(400).json({ success: false, message: 'photos must be an array of photo paths' });
    }

    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    // Validate that the provided photos match the venue's current photos
    const currentPhotos = venue.photos || [];
    if (photos.length !== currentPhotos.length) {
      return res.status(400).json({
        success: false,
        message: 'Reordered photos array must contain all existing venue photos',
      });
    }

    const currentSet = new Set(currentPhotos);
    for (const p of photos) {
      if (!currentSet.has(p)) {
        return res.status(400).json({
          success: false,
          message: `Photo ${p} does not belong to this venue`,
        });
      }
    }

    venue.photos = photos;
    await venue.save();

    res.json({ success: true, data: venue.photos });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/venues/:id/layout
// Upload or replace court layout image
// ---------------------------------------------------------------------------
const uploadCourtLayout = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No layout image uploaded' });
    }

    // Delete previous layout image file if stored locally
    if (venue.layoutImage && (venue.layoutImage.startsWith('/uploads/') || venue.layoutImage.startsWith('uploads/'))) {
      const oldFilename = path.basename(venue.layoutImage);
      const oldPath = path.join(__dirname, '..', 'uploads', oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (e) { console.error('Failed to unlink old layout image:', e.message); }
      }
    }

    venue.layoutImage = '/uploads/' + req.file.filename;
    await venue.save();

    res.json({ success: true, layoutImage: venue.layoutImage, data: venue.layoutImage });
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/admin/venues/:id/layout
// Remove court layout image
// ---------------------------------------------------------------------------
const deleteCourtLayout = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    if (venue.layoutImage && (venue.layoutImage.startsWith('/uploads/') || venue.layoutImage.startsWith('uploads/'))) {
      const filename = path.basename(venue.layoutImage);
      const filePath = path.join(__dirname, '..', 'uploads', filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error('Failed to unlink layout image:', e.message); }
      }
    }

    venue.layoutImage = null;
    await venue.save();

    res.json({ success: true, message: 'Layout image removed' });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/venues/:id/payment-qr
// Upload or replace DuitNow QR image
// ---------------------------------------------------------------------------
const uploadPaymentQr = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No QR image uploaded' });
    }

    // Delete previous QR image file if stored locally
    venue.paymentInfo = venue.paymentInfo || {};
    const oldQr = venue.paymentInfo.duitNowQr;
    if (oldQr && (oldQr.startsWith('/uploads/') || oldQr.startsWith('uploads/'))) {
      const oldFilename = path.basename(oldQr);
      const oldPath = path.join(__dirname, '..', 'uploads', oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (e) { console.error('Failed to unlink old QR image:', e.message); }
      }
    }

    venue.paymentInfo.duitNowQr = '/uploads/' + req.file.filename;
    await venue.save();

    res.json({ success: true, duitNowQr: venue.paymentInfo.duitNowQr, data: venue.paymentInfo });
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/admin/venues/:id/payment-qr
// Remove DuitNow QR image
// ---------------------------------------------------------------------------
const deletePaymentQr = async (req, res, next) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    venue.paymentInfo = venue.paymentInfo || {};
    const oldQr = venue.paymentInfo.duitNowQr;
    if (oldQr && (oldQr.startsWith('/uploads/') || oldQr.startsWith('uploads/'))) {
      const filename = path.basename(oldQr);
      const filePath = path.join(__dirname, '..', 'uploads', filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error('Failed to unlink QR image:', e.message); }
      }
    }

    venue.paymentInfo.duitNowQr = '';
    await venue.save();

    res.json({ success: true, message: 'Payment QR removed successfully', data: venue.paymentInfo });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/venues/:id/shop-items
// ---------------------------------------------------------------------------
const getVenueShopItems = async (req, res, next) => {
  try {
    const items = await ShopItem.find({ venueId: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/admin/venues/:id/shop-items
// ---------------------------------------------------------------------------
const createShopItem = async (req, res, next) => {
  try {
    const { name, description, category, price, isAvailable, notePrompt, readyInfo } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (name.trim().length > 60) {
      return res.status(400).json({ success: false, message: 'Name must not exceed 60 characters' });
    }

    if (!category || !['product', 'service'].includes(category)) {
      return res.status(400).json({ success: false, message: 'Category must be either product or service' });
    }

    if (price === undefined || price === null || price === '' || isNaN(Number(price))) {
      return res.status(400).json({ success: false, message: 'Price is required and must be a number' });
    }
    const numPrice = Number(price);
    if (numPrice < 0 || numPrice > 1000) {
      return res.status(400).json({ success: false, message: 'Price must be between 0 and 1000' });
    }
    const roundedPrice = Math.round(numPrice * 100) / 100;

    const item = await ShopItem.create({
      venueId: req.params.id,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim().slice(0, 200) : '',
      category,
      price: roundedPrice,
      isAvailable: isAvailable !== false,
      notePrompt: typeof notePrompt === 'string' ? notePrompt.trim().slice(0, 100) : '',
      readyInfo: typeof readyInfo === 'string' ? readyInfo.trim().slice(0, 60) : '',
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/venues/:id/shop-items/:itemId
// ---------------------------------------------------------------------------
const updateShopItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const item = await ShopItem.findOne({ _id: itemId, venueId: req.params.id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    delete req.body.venueId;
    delete req.body._id;
    delete req.body.createdAt;

    const { name, description, category, price, isAvailable, notePrompt, readyInfo } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Name cannot be empty' });
      }
      if (name.trim().length > 60) {
        return res.status(400).json({ success: false, message: 'Name must not exceed 60 characters' });
      }
      item.name = name.trim();
    }

    if (category !== undefined) {
      if (!['product', 'service'].includes(category)) {
        return res.status(400).json({ success: false, message: 'Category must be either product or service' });
      }
      item.category = category;
    }

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0 || numPrice > 1000) {
        return res.status(400).json({ success: false, message: 'Price must be between 0 and 1000' });
      }
      item.price = Math.round(numPrice * 100) / 100;
    }

    if (description !== undefined) {
      item.description = typeof description === 'string' ? description.trim().slice(0, 200) : '';
    }

    if (isAvailable !== undefined) {
      item.isAvailable = Boolean(isAvailable);
    }

    if (notePrompt !== undefined) {
      item.notePrompt = typeof notePrompt === 'string' ? notePrompt.trim().slice(0, 100) : '';
    }

    if (readyInfo !== undefined) {
      item.readyInfo = typeof readyInfo === 'string' ? readyInfo.trim().slice(0, 60) : '';
    }

    await item.save();

    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/admin/venues/:id/shop-items/:itemId
// ---------------------------------------------------------------------------
const deleteShopItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const item = await ShopItem.findOne({ _id: itemId, venueId: req.params.id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    await item.deleteOne();

    res.json({ success: true, message: 'Shop item deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminVenues,
  createVenue,
  updateVenue,
  uploadVenuePhotos,
  deleteVenuePhoto,
  reorderVenuePhotos,
  uploadCourtLayout,
  deleteCourtLayout,
  uploadPaymentQr,
  deletePaymentQr,
  getVenueShopItems,
  createShopItem,
  updateShopItem,
  deleteShopItem,
};

