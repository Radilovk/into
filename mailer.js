// Simple mailer module using nodemailer
// Provides utility functions to send various emails for IntoDesign Studio
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send a welcome email to a new user.
 * @param {string} to - Recipient email address
 * @param {string} name - Recipient name for personalization
 */
export async function sendWelcomeEmail(to, name) {
  const message = {
    from: 'IntoDesign <no-reply@intodesign.bg>',
    to,
    subject: 'Добре дошли в IntoDesign Studio',
    text: `Здравейте, ${name}! Благодарим ви, че се свързахте с нашия екип.`,
    html: `<p>Здравейте, <strong>${name}</strong>!</p><p>Благодарим ви, че се свързахте с нашия екип.</p>`
  };
  return transporter.sendMail(message);
}

/**
 * Send a password reset email with provided link
 * @param {string} to - Recipient email address
 * @param {string} resetLink - URL for password reset
 */
export async function sendPasswordResetEmail(to, resetLink) {
  const message = {
    from: 'IntoDesign <no-reply@intodesign.bg>',
    to,
    subject: 'Заявка за подновяване на парола',
    text: `Можете да промените паролата си тук: ${resetLink}`,
    html: `<p>Можете да промените паролата си като последвате <a href="${resetLink}">този линк</a>.</p>`
  };
  return transporter.sendMail(message);
}

/**
 * Send a generic notification email.
 * @param {object} options - Message options { to, subject, text, html }
 */
export async function sendNotificationEmail(options) {
  const message = {
    from: 'IntoDesign <no-reply@intodesign.bg>',
    ...options
  };
  return transporter.sendMail(message);
}

/**
 * Send email with the contents of the inquiry form.
 * @param {object} data - { name, email, phone, subject, message }
 */
export async function sendInquiryEmail(data) {
  const { name, email, phone, subject, message } = data;
  const text = `Име: ${name}\nИмейл: ${email}\nТелефон: ${phone || 'Няма'}\nОтносно: ${subject}\n\n${message}`;
  const msg = {
    from: 'IntoDesign <no-reply@intodesign.bg>',
    to: process.env.CONTACT_EMAIL,
    subject: `Ново запитване: ${subject}`,
    text,
    html: `<p><strong>Име:</strong> ${name}</p><p><strong>Имейл:</strong> ${email}</p><p><strong>Телефон:</strong> ${phone || 'Няма'}</p><p><strong>Относно:</strong> ${subject}</p><p>${message}</p>`
  };
  return transporter.sendMail(msg);
}
