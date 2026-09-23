const Notification = require('../models/Notification');

exports.getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ playerId: req.user._id })
      .sort({ sentAt: -1 })
      .limit(20);
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, playerId: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ playerId: req.user._id, isRead: { $ne: true } });
    res.json({ success: true, count });
  } catch (err) {
    next(err);
  }
};
