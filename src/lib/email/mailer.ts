import "server-only";
import nodemailer from "nodemailer";

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM
  );
}

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(email: OutboundEmail): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM."
    );
  }
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10) || 587;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email.to,
    subject: email.subject,
    text: email.text,
  });
}
