const { chat, ChatbotError } = require('../services/chatbot');

const postChat = async (req, res, next) => {
  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) {
    return res.status(400).json({ success: false, message: 'Invalid messages.' });
  }

  const lastItem = messages[messages.length - 1];
  const trimmed = (lastItem && typeof lastItem.text === 'string') ? lastItem.text.trim() : '';

  if (!lastItem || typeof lastItem !== 'object' || lastItem.role !== 'user' || typeof lastItem.text !== 'string' || trimmed.length < 1 || trimmed.length > 500) {
    return res.status(400).json({ success: false, message: 'Message must be 1-500 characters.' });
  }

  try {
    const { reply } = await chat(messages);
    res.json({ success: true, reply });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = { postChat };
