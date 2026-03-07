export async function sendEmail(env: any, to: string, subject: string, html: string) {
  // Check if Resend API Key is available in environment
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const SENDGRID_API_KEY = env.SENDGRID_API_KEY;
  const FROM_EMAIL = env.SENDER_EMAIL || 'no-reply@scout-management.com';

  if (!to) return { success: false, error: 'No recipient provided' };

  console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);

  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_EMAIL.includes('@') ? FROM_EMAIL : `Scout System <no-reply@resend.dev>`,
          to: [to],
          subject: subject,
          html: html
        })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('Resend API Error:', err);
        return { success: false, error: err };
      }
      return { success: true };
    } catch (e: any) {
      console.error('Email sending failed (Resend):', e);
      return { success: false, error: e.message };
    }
  } else if (SENDGRID_API_KEY) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: FROM_EMAIL, name: 'Scout System' },
          subject: subject,
          content: [{ type: 'text/html', value: html }]
        })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('SendGrid API Error:', err);
        return { success: false, error: err };
      }
      return { success: true };
    } catch (e: any) {
      console.error('Email sending failed (SendGrid):', e);
      return { success: false, error: e.message };
    }
  } else {
    console.log('[Email Skipped] No Email API keys configured (RESEND_API_KEY / SENDGRID_API_KEY). Content:', html);
    // Return success true so it doesn't break the flow when keys are absent
    return { success: true, simulated: true };
  }
}
