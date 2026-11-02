const mongoose = require('mongoose');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const { saveFile, deleteFile } = require('../utils/storage');
const { getOwnedVenueIds } = require('../utils/venueAccess');
const {
    todayMY,
    isValidDateString,
    isValidTimeString,
    timeToMinutes,
    addDaysToDateString,
    toMYDate,
} = require('../utils/malaysiaTime');

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------
const LIMITS = { title: 80, description: 1000, howToJoin: 300, fee: 60, reasonMin: 5, reasonMax: 300 };
const MAX_UPCOMING_PER_VENUE = 20;
const MAX_DAYS_AHEAD = 365;
const EDITABLE_FIELDS = ['title', 'description', 'date', 'startTime', 'endTime', 'howToJoin', 'fee'];
const ADMIN_PAGE_SIZE = 20;

// Events an owner removed after they were hidden: kept for the admin, invisible to everyone else
const NOT_DELETED = { deletedByOwnerAt: null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// An event is over once its end time has passed in Malaysia time
const isEventEnded = (e, now = new Date()) => toMYDate(e.date, e.endTime).getTime() <= now.getTime();

// Whitelist: only these fields can ever be set by an owner (moderation fields never)
const pickFields = (body, base) => {
    const out = {};
    for (const k of EDITABLE_FIELDS) {
        if (body && Object.prototype.hasOwnProperty.call(body, k)) out[k] = str(body[k]);
        else out[k] = base && base[k] != null ? base[k] : '';
    }
    return out;
};

// Returns an error message, or null if valid
const validateEventFields = (f, now = new Date()) => {
    if (!f.title) return 'Title is required';
    if (f.title.length > LIMITS.title) return `Title cannot exceed ${LIMITS.title} characters`;
    if (!f.description) return 'Description is required';
    if (f.description.length > LIMITS.description) return `Description cannot exceed ${LIMITS.description} characters`;
    if (!isValidDateString(f.date)) return 'Date must be a valid date (YYYY-MM-DD)';
    if (!isValidTimeString(f.startTime) || !isValidTimeString(f.endTime)) return 'Start and end time must be in HH:MM format';
    if (timeToMinutes(f.endTime) <= timeToMinutes(f.startTime)) return 'End time must be after start time';
    const today = todayMY(now);
    if (f.date < today) return 'Event date cannot be in the past';
    if (f.date > addDaysToDateString(today, MAX_DAYS_AHEAD)) return `Event date cannot be more than ${MAX_DAYS_AHEAD} days ahead`;
    if (isEventEnded(f, now)) return 'This event would already be over. Choose a later end time';
    if (f.howToJoin.length > LIMITS.howToJoin) return `How to join cannot exceed ${LIMITS.howToJoin} characters`;
    if (f.fee.length > LIMITS.fee) return `Fee cannot exceed ${LIMITS.fee} characters`;
    return null;
};

// Owner view: own event incl. moderation status, but not which admin hid it
const toOwnerJSON = (e, now = new Date()) => {
    const o = e.toObject();
    delete o.hiddenBy;
    delete o.deletedByOwnerAt;
    delete o.__v;
    o.isPast = isEventEnded(e, now);
    return o;
};

// Public view: no moderation fields, no createdBy
const toPublicJSON = (e) => ({
    _id: e._id,
    title: e.title,
    description: e.description,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    posterImage: e.posterImage,
    howToJoin: e.howToJoin,
    fee: e.fee,
    venue: e.venueId && e.venueId._id
        ? { _id: e.venueId._id, name: e.venueId.name, area: e.venueId.area }
        : undefined,
});

const activeVenueIds = async () =>
    (await Venue.find({ isActive: { $ne: false } }).select('_id')).map((v) => v._id);

const findOwnEvent = (venueId, eventId) => Event.findOne({ _id: eventId, venueId, ...NOT_DELETED });

// ---------------------------------------------------------------------------
// OWNER  (routes: requireRole('venue_owner') + requireVenueAccess('id'))
// ---------------------------------------------------------------------------

// GET /api/admin/venues/:id/events  -> all events of this venue (upcoming first, then past)
const getOwnerVenueEvents = async (req, res, next) => {
    try {
        const now = new Date();
        const events = await Event.find({ venueId: req.params.id, ...NOT_DELETED }).sort({ date: 1, startTime: 1 });
        const data = events.map((e) => toOwnerJSON(e, now));
        const upcoming = data.filter((e) => !e.isPast);
        const past = data.filter((e) => e.isPast).reverse();
        res.json({ success: true, count: data.length, data: [...upcoming, ...past] });
    } catch (err) {
        next(err);
    }
};

// GET /api/admin/events/hidden-count  (venue_owner) -> upcoming hidden events across own venues (tab badge)
const getOwnerHiddenEventCount = async (req, res, next) => {
    try {
        const now = new Date();
        const venueIds = await getOwnedVenueIds(req.user);
        const events = await Event.find({
            venueId: { $in: venueIds || [] },
            isHidden: true,
            date: { $gte: todayMY(now) },
            ...NOT_DELETED,
        }).select('date endTime');
        const count = events.filter((e) => !isEventEnded(e, now)).length;
        res.json({ success: true, count });
    } catch (err) {
        next(err);
    }
};

// POST /api/admin/venues/:id/events
const createEvent = async (req, res, next) => {
    try {
        const now = new Date();
        const fields = pickFields(req.body || {}, null);
        const error = validateEventFields(fields, now);
        if (error) return res.status(400).json({ success: false, message: error });

        const upcomingCount = await Event.countDocuments({
            venueId: req.params.id,
            date: { $gte: todayMY(now) },
            ...NOT_DELETED,
        });
        if (upcomingCount >= MAX_UPCOMING_PER_VENUE) {
            return res.status(400).json({
                success: false,
                message: `A venue can have at most ${MAX_UPCOMING_PER_VENUE} upcoming events`,
            });
        }

        const event = await Event.create({ ...fields, venueId: req.params.id, createdBy: req.user._id });
        res.status(201).json({ success: true, data: toOwnerJSON(event, now) });
    } catch (err) {
        next(err);
    }
};

// PATCH /api/admin/venues/:id/events/:eventId
// Hidden events stay hidden after editing (only an admin can restore).
const updateEvent = async (req, res, next) => {
    try {
        const now = new Date();
        const { eventId } = req.params;
        if (!mongoose.isValidObjectId(eventId)) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        const event = await findOwnEvent(req.params.id, eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (isEventEnded(event, now)) {
            return res.status(400).json({ success: false, message: 'Past events cannot be edited' });
        }

        const fields = pickFields(req.body || {}, event);
        const error = validateEventFields(fields, now);
        if (error) return res.status(400).json({ success: false, message: error });

        for (const k of EDITABLE_FIELDS) event[k] = fields[k];
        await event.save();
        res.json({ success: true, data: toOwnerJSON(event, now) });
    } catch (err) {
        next(err);
    }
};

// DELETE /api/admin/venues/:id/events/:eventId
// Visible event -> deleted for real (record + poster file).
// Hidden event  -> soft delete: gone for the owner, kept (with poster) as the admin's moderation record.
const deleteEvent = async (req, res, next) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.isValidObjectId(eventId)) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        const event = await findOwnEvent(req.params.id, eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        if (event.isHidden) {
            event.deletedByOwnerAt = new Date();
            await event.save();
            return res.json({ success: true, message: 'Event removed' });
        }

        const oldPoster = event.posterImage;
        await event.deleteOne();
        if (oldPoster) await deleteFile(oldPoster);

        res.json({ success: true, message: 'Event deleted' });
    } catch (err) {
        next(err);
    }
};

// Middleware before multer: event exists, belongs to this venue, not deleted, not over yet
const verifyEventEditable = async (req, res, next) => {
    try {
        const { id, eventId } = req.params;
        if (!mongoose.isValidObjectId(eventId)) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        const event = await findOwnEvent(id, eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (isEventEnded(event)) {
            return res.status(400).json({ success: false, message: 'Past events cannot be edited' });
        }
        req.event = event;
        next();
    } catch (err) {
        next(err);
    }
};

// POST /api/admin/venues/:id/events/:eventId/poster  (field name: poster)
// Order: validate -> save new file -> save DB -> delete old file
const uploadEventPoster = async (req, res, next) => {
    try {
        const event = req.event;
        if (!req.file) return res.status(400).json({ success: false, message: 'No poster uploaded' });

        let newPoster;
        try {
            newPoster = await saveFile(req.file.buffer, 'event-poster', req.params.id);
        } catch (saveErr) {
            if (saveErr.statusCode === 400) {
                return res.status(400).json({ success: false, message: saveErr.message });
            }
            throw saveErr;
        }

        const oldPoster = event.posterImage;
        event.posterImage = newPoster;
        try {
            await event.save();
        } catch (dbErr) {
            await deleteFile(newPoster);
            throw dbErr;
        }
        if (oldPoster) await deleteFile(oldPoster);

        res.json({ success: true, data: toOwnerJSON(event) });
    } catch (err) {
        next(err);
    }
};

// DELETE /api/admin/venues/:id/events/:eventId/poster
const deleteEventPoster = async (req, res, next) => {
    try {
        const event = req.event;
        const oldPoster = event.posterImage;
        event.posterImage = null;
        await event.save();
        if (oldPoster) await deleteFile(oldPoster);
        res.json({ success: true, data: toOwnerJSON(event) });
    } catch (err) {
        next(err);
    }
};

// ---------------------------------------------------------------------------
// ADMIN  (routes: adminOnly)
// ---------------------------------------------------------------------------

// GET /api/admin/events?page=1&venueId=&status=visible|hidden&when=upcoming|past
// Includes events the owner removed (deletedByOwnerAt set) so the moderation history stays complete.
const getAdminEvents = async (req, res, next) => {
    try {
        const now = new Date();
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const filter = {};

        if (req.query.venueId) {
            if (!mongoose.isValidObjectId(req.query.venueId)) {
                return res.status(400).json({ success: false, message: 'Invalid venue' });
            }
            filter.venueId = req.query.venueId;
        }
        if (req.query.status === 'visible') filter.isHidden = { $ne: true };
        else if (req.query.status === 'hidden') filter.isHidden = true;

        const today = todayMY(now);
        if (req.query.when === 'upcoming') filter.date = { $gte: today };
        else if (req.query.when === 'past') filter.date = { $lt: today };

        const [events, total] = await Promise.all([
            Event.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * ADMIN_PAGE_SIZE)
                .limit(ADMIN_PAGE_SIZE)
                .populate('venueId', 'name area')
                .populate('createdBy', 'fullName email')
                .populate('hiddenBy', 'fullName email'),
            Event.countDocuments(filter),
        ]);

        const data = events.map((e) => {
            const o = e.toObject();
            delete o.__v;
            o.isPast = isEventEnded(e, now);
            return o;
        });

        res.json({
            success: true,
            count: data.length,
            total,
            page,
            pages: Math.ceil(total / ADMIN_PAGE_SIZE),
            data,
        });
    } catch (err) {
        next(err);
    }
};

// PATCH /api/admin/events/:eventId/hide { reason }
const hideEvent = async (req, res, next) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.isValidObjectId(eventId)) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        const reason = str((req.body || {}).reason);
        if (reason.length < LIMITS.reasonMin) {
            return res.status(400).json({
                success: false,
                message: `A reason of at least ${LIMITS.reasonMin} characters is required to hide an event`,
            });
        }
        if (reason.length > LIMITS.reasonMax) {
            return res.status(400).json({ success: false, message: `Reason cannot exceed ${LIMITS.reasonMax} characters` });
        }

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (event.deletedByOwnerAt) {
            return res.status(400).json({ success: false, message: 'The owner has removed this event' });
        }

        event.isHidden = true;
        event.hiddenReason = reason;
        event.hiddenAt = new Date();
        event.hiddenBy = req.user._id;
        await event.save();

        res.json({ success: true, message: 'Event hidden', data: event });
    } catch (err) {
        next(err);
    }
};

// PATCH /api/admin/events/:eventId/restore
const restoreEvent = async (req, res, next) => {
    try {
        const { eventId } = req.params;
        if (!mongoose.isValidObjectId(eventId)) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (event.deletedByOwnerAt) {
            return res.status(400).json({ success: false, message: 'The owner has removed this event, so it cannot be restored' });
        }
        if (!event.isHidden) return res.status(400).json({ success: false, message: 'Event is not hidden' });

        event.isHidden = false;
        event.hiddenReason = null;
        event.hiddenAt = null;
        event.hiddenBy = null;
        await event.save();

        res.json({ success: true, message: 'Event restored', data: event });
    } catch (err) {
        next(err);
    }
};

// ---------------------------------------------------------------------------
// PUBLIC  (guests + players, rate limited)
// ---------------------------------------------------------------------------

// GET /api/events -> upcoming, visible events at active venues, soonest first
const getPublicEvents = async (req, res, next) => {
    try {
        const now = new Date();
        const venueIds = await activeVenueIds();
        const events = await Event.find({
            venueId: { $in: venueIds },
            isHidden: { $ne: true },
            date: { $gte: todayMY(now) },
            ...NOT_DELETED,
        })
            .sort({ date: 1, startTime: 1 })
            .limit(200)
            .populate('venueId', 'name area');

        const data = events.filter((e) => !isEventEnded(e, now)).map(toPublicJSON);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        next(err);
    }
};

// GET /api/venues/:id/events -> upcoming, visible events of one active venue
const getPublicVenueEvents = async (req, res, next) => {
    try {
        const now = new Date();
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ success: false, message: 'Venue not found' });
        }
        const venue = await Venue.findOne({ _id: id, isActive: { $ne: false } }).select('_id');
        if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });

        const events = await Event.find({
            venueId: id,
            isHidden: { $ne: true },
            date: { $gte: todayMY(now) },
            ...NOT_DELETED,
        })
            .sort({ date: 1, startTime: 1 })
            .populate('venueId', 'name area');

        const data = events.filter((e) => !isEventEnded(e, now)).map(toPublicJSON);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getOwnerVenueEvents,
    getOwnerHiddenEventCount,
    createEvent,
    updateEvent,
    deleteEvent,
    verifyEventEditable,
    uploadEventPoster,
    deleteEventPoster,
    getAdminEvents,
    hideEvent,
    restoreEvent,
    getPublicEvents,
    getPublicVenueEvents,
};