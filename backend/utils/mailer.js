import nodemailer from 'nodemailer';

const ready = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const transporter = ready ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

export async function sendEmail({to,subject,html}) {
  if (!transporter || !to) return false;
  try {
    await transporter.sendMail({from: process.env.SMTP_FROM || process.env.SMTP_USER,to,subject,html});
    return true;
  } catch (error) {
    console.error('Email delivery skipped:', error.message);
    return false;
  }
}
