import nodemailer, { type Transporter, type SendMailOptions } from 'nodemailer';
import { markEmailSent, markEmailFailed, processEmailQueue } from './queue';

let transporter: Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmailDirect(to: string, subject: string, html: string) {
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || 'noreply@timetrack.asia',
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function processEmailWorker() {
  const emails = await processEmailQueue();

  for (const email of emails) {
    try {
      await getTransporter().sendMail({
        from: process.env.SMTP_FROM || 'noreply@timetrack.asia',
        to: email.to_address,
        subject: email.subject,
        html: email.html_body,
        attachments: Array.isArray(email.attachments) && email.attachments.length > 0
          ? (email.attachments as SendMailOptions['attachments'])
          : undefined,
      });
      await markEmailSent(email.id);
    } catch (error) {
      await markEmailFailed(email.id, (error as Error).message);
    }
  }

  return { processed: emails.length };
}

// For use in Server Actions / Route Handlers
export async function sendRegistrationConfirmation(
  to: string,
  data: {
    eventName: string;
    registrationNumber: string;
    participantName: string;
    eventDate: string;
    dashboardUrl: string;
  }
) {
  const html = `
    <div style="background:#000;color:#fff;font-family:Inter,sans-serif;padding:40px;text-align:center">
      <div style="max-width:480px;margin:0 auto">
        <div style="background:#ccff00;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px">
          <span style="color:#000;font-weight:900;font-size:20px">TT</span>
        </div>
        <h1 style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:8px">Registration Confirmed!</h1>
        <p style="color:#a1a1a1;font-size:14px;margin-bottom:24px">
          You're registered for <strong style="color:#fff">${data.eventName}</strong>
        </p>
        <div style="background:#1a1a1a;border-radius:16px;padding:24px;margin-bottom:24px">
          <p style="font-size:12px;color:#a1a1a1;text-transform:uppercase;letter-spacing:0.1em;font-weight:700">Registration #${data.registrationNumber}</p>
          <p style="font-size:14px;color:#fff;font-weight:700">${data.participantName}</p>
          <p style="font-size:12px;color:#a1a1a1">${data.eventDate}</p>
        </div>
        <a href="${data.dashboardUrl}" style="display:inline-block;background:#ccff00;color:#000;padding:16px 32px;border-radius:999px;font-weight:900;font-size:14px;text-transform:uppercase;text-decoration:none">View Dashboard</a>
      </div>
    </div>
  `;

  return sendEmailDirect(to, `Registration Confirmed - ${data.eventName}`, html);
}

export async function sendPaymentConfirmation(
  to: string,
  data: {
    eventName: string;
    amount: string;
    invoiceUrl: string;
  }
) {
  const html = `
    <div style="background:#000;color:#fff;font-family:Inter,sans-serif;padding:40px;text-align:center">
      <div style="max-width:480px;margin:0 auto">
        <div style="background:#ccff00;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px">
          <span style="color:#000;font-weight:900;font-size:20px">TT</span>
        </div>
        <h1 style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:8px">Payment Successful!</h1>
        <p style="color:#a1a1a1;font-size:14px;margin-bottom:24px">
          Your payment of <strong style="color:#ccff00">RM${data.amount}</strong> for ${data.eventName} has been received.
        </p>
        <a href="${data.invoiceUrl}" style="display:inline-block;background:#ccff00;color:#000;padding:16px 32px;border-radius:999px;font-weight:900;font-size:14px;text-transform:uppercase;text-decoration:none">Download Invoice</a>
      </div>
    </div>
  `;

  return sendEmailDirect(to, `Payment Received - ${data.eventName}`, html);
}
