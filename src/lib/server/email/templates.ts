export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), () => value);
  }
  return result;
}

export const emailLayout = (content: string) => `
  <div style="background:#000;color:#fff;font-family:Inter,sans-serif;padding:40px;text-align:center">
    <div style="max-width:480px;margin:0 auto">
      <div style="background:#ccff00;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px">
        <span style="color:#000;font-weight:900;font-size:20px">TT</span>
      </div>
      ${content}
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #1a1a1a">
        <p style="font-size:10px;color:#444;text-transform:uppercase;letter-spacing:0.1em;font-weight:700">
          Time Track &copy; ${new Date().getFullYear()} | Every Second Counts
        </p>
      </div>
    </div>
  </div>
`;

export const templates = {
  registrationConfirmation: (vars: Record<string, string>) => emailLayout(`
    <h1 style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:8px">Registration Confirmed!</h1>
    <p style="color:#a1a1a1;font-size:14px;margin-bottom:24px">
      You're registered for <strong style="color:#fff">${vars.event_name}</strong>
    </p>
    <div style="background:#1a1a1a;border-radius:16px;padding:24px;margin-bottom:24px">
      <p style="font-size:12px;color:#a1a1a1;text-transform:uppercase;letter-spacing:0.1em;font-weight:700">Registration #${vars.registration_number}</p>
      <p style="font-size:14px;color:#fff;font-weight:700">${vars.participant_name}</p>
      <p style="font-size:12px;color:#a1a1a1">${vars.event_date}</p>
    </div>
    <a href="${vars.dashboard_url}" style="display:inline-block;background:#ccff00;color:#000;padding:16px 32px;border-radius:999px;font-weight:900;font-size:14px;text-transform:uppercase;text-decoration:none">View Dashboard</a>
  `),

  paymentSuccess: (vars: Record<string, string>) => emailLayout(`
    <h1 style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:8px">Payment Successful!</h1>
    <p style="color:#a1a1a1;font-size:14px;margin-bottom:24px">
      Your payment of <strong style="color:#ccff00">RM${vars.amount}</strong> for ${vars.event_name} has been received.
    </p>
    <a href="${vars.invoice_url}" style="display:inline-block;background:#ccff00;color:#000;padding:16px 32px;border-radius:999px;font-weight:900;font-size:14px;text-transform:uppercase;text-decoration:none">Download Invoice</a>
  `),

  paymentFailed: (vars: Record<string, string>) => emailLayout(`
    <div style="background:#ef4444;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px">
      <span style="color:#fff;font-weight:900;font-size:20px">!</span>
    </div>
    <h1 style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:8px">Payment Failed</h1>
    <p style="color:#a1a1a1;font-size:14px;margin-bottom:24px">
      Your payment of <strong style="color:#fff">RM${vars.amount}</strong> for ${vars.event_name} could not be processed.
    </p>
    <a href="${vars.retry_url}" style="display:inline-block;background:#ccff00;color:#000;padding:16px 32px;border-radius:999px;font-weight:900;font-size:14px;text-transform:uppercase;text-decoration:none">Retry Payment</a>
  `),

  resultAvailable: (vars: Record<string, string>) => emailLayout(`
    <h1 style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:8px">Results Are In!</h1>
    <p style="color:#a1a1a1;font-size:14px;margin-bottom:24px">
      Your results for <strong style="color:#fff">${vars.event_name}</strong> are now available.
    </p>
    <p style="font-size:32px;font-weight:900;color:#ccff00">${vars.overall_rank}</p>
    <p style="font-size:12px;color:#a1a1a1;text-transform:uppercase;letter-spacing:0.1em">Overall Rank</p>
    <a href="${vars.results_url}" style="display:inline-block;background:#ccff00;color:#000;padding:16px 32px;border-radius:999px;font-weight:900;font-size:14px;text-transform:uppercase;text-decoration:none;margin-top:24px">View Results</a>
  `),

  certificateAvailable: (vars: Record<string, string>) => emailLayout(`
    <h1 style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:8px">Certificate Ready!</h1>
    <p style="color:#a1a1a1;font-size:14px;margin-bottom:24px">
      Your certificate for <strong style="color:#fff">${vars.event_name}</strong> is ready to download.
    </p>
    <a href="${vars.certificate_url}" style="display:inline-block;background:#ccff00;color:#000;padding:16px 32px;border-radius:999px;font-weight:900;font-size:14px;text-transform:uppercase;text-decoration:none">Download Certificate</a>
  `),

  eventReminder: (vars: Record<string, string>) => emailLayout(`
    <h1 style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:8px">Race Day Tomorrow!</h1>
    <p style="color:#a1a1a1;font-size:14px;margin-bottom:24px">
      <strong style="color:#fff">${vars.event_name}</strong> is happening tomorrow at ${vars.venue_name}.
    </p>
    <div style="background:#1a1a1a;border-radius:16px;padding:24px;margin-bottom:24px">
      <p style="font-size:12px;color:#a1a1a1;text-transform:uppercase;letter-spacing:0.1em">Date & Time</p>
      <p style="font-size:16px;color:#fff;font-weight:700">${vars.event_date}</p>
      <p style="font-size:12px;color:#a1a1a1;margin-top:12px;text-transform:uppercase;letter-spacing:0.1em">Location</p>
      <p style="font-size:14px;color:#fff">${vars.address}</p>
    </div>
    <p style="font-size:12px;color:#a1a1a1">Don't forget your bib and IC!</p>
  `),
};
