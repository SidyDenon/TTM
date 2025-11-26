import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMail(to, subject, text) {
  return transporter.sendMail({
    from: `"TTM 🚗" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}
