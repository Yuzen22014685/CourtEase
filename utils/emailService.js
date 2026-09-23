const nodemailer = require('nodemailer');

const port = parseInt(process.env.SMTP_PORT, 10) || 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Verify SMTP connection on server startup without crashing on failure
 */
const verifySMTP = () => {
  transporter.verify((err) => {
    if (err) {
      console.warn('⚠️  SMTP verification failed (check credentials or connection):', err.message);
    } else {
      console.log('✅ SMTP ready');
    }
  });
};

/**
 * General helper to send an email
 */
const sendEmail = async ({ to, subject, html }) => {
  const from = process.env.EMAIL_FROM || '"CourtEase" <no-reply@courtease.my>';
  return await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
};

/**
 * Send an email verification link to a newly registered user
 */
const sendVerificationEmail = async (user, rawToken) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verifyUrl = `${clientUrl}/verify-email/${rawToken}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 42px;">🏸</span>
        <h1 style="color: #111827; font-size: 24px; margin-top: 8px; margin-bottom: 4px;">Welcome to CourtEase</h1>
        <p style="color: #6b7280; font-size: 14px; margin: 0;">Penang's badminton court booking platform</p>
      </div>

      <p style="color: #374151; font-size: 16px; line-height: 24px;">
        Hello <strong>${user.fullName}</strong>,
      </p>

      <p style="color: #374151; font-size: 15px; line-height: 24px;">
        Thank you for creating an account with CourtEase! Please confirm your email address by clicking the button below:
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}"
           style="background-color: #16a34a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
          Verify my email
        </a>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 20px;">
        Or copy and paste this link into your browser:<br/>
        <a href="${verifyUrl}" style="color: #16a34a; word-break: break-all;">${verifyUrl}</a>
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

      <p style="color: #9ca3af; font-size: 12px; line-height: 18px; margin: 0;">
        ⏱️ Note: This verification link will expire in 24 hours.<br/>
        If you did not register for an account on CourtEase, please safely ignore this email.
      </p>
    </div>
  `;

  return await sendEmail({
    to: user.email,
    subject: 'Verify your CourtEase account',
    html,
  });
};

module.exports = {
  transporter,
  verifySMTP,
  sendEmail,
  sendVerificationEmail,
};
