const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');

let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Send an email verification or transactional message
 */
async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    console.log(`[SpendSmart Email Simulation] To: ${to} | Subject: ${subject}`);
    if (text) console.log(`[SpendSmart Email Content] ${text}`);
    return { simulated: true, success: true };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"SpendSmart" <no-reply@spendsmart.local>',
      to,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SpendSmart Email Error] ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Create an in-app notification record
 */
async function createInAppNotification({ userId, title, message, type = 'system', link = '' }) {
  try {
    const notif = await Notification.create({
      user: userId,
      title,
      message,
      type,
      link,
    });
    return notif;
  } catch (err) {
    console.error('[SpendSmart Notification Creation Error]:', err.message);
  }
}

module.exports = {
  sendEmail,
  createInAppNotification,
};
