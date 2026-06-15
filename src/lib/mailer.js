import { Resend } from "resend";

// Server-only. Sends transactional OTP emails through Resend. The runtime app
// sends its own mail here; Supabase's built-in mailer is disabled.
//
// Lazily construct the client so importing this module never requires the API
// key. Constructing `new Resend(undefined)` throws "Missing API key", which
// would crash `next build` when it evaluates this module during page-data
// collection. With lazy init the key is only needed at send time (runtime).
let _resend;
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return (_resend ??= new Resend(key));
}

const APP_NAME = "Protokoll App";

function otpEmailHtml(intro, code) {
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 480px; margin: 0 auto;">
      <h2 style="font-weight: 600;">${APP_NAME}</h2>
      <p>${intro}</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${code}</p>
      <p style="color: #666; font-size: 14px;">Der Code ist 60 Minuten gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
    </div>
  `;
}

async function sendOtp({ to, subject, intro, code }) {
  const { error } = await getResend().emails.send({
    from: process.env.RESEND_FROM,
    to,
    subject,
    html: otpEmailHtml(intro, code),
    text: `${intro}\n\n${code}\n\nDer Code ist 60 Minuten gültig.`,
  });

  if (error) {
    throw new Error(error.message || "E-Mail konnte nicht gesendet werden");
  }
}

export function sendVerificationEmail(to, code) {
  return sendOtp({
    to,
    subject: `${APP_NAME}: Bestätige deine E-Mail`,
    intro:
      "Gib diesen Code in der App ein, um deine E-Mail-Adresse zu bestätigen:",
    code,
  });
}

export function sendPasswordResetEmail(to, code) {
  return sendOtp({
    to,
    subject: `${APP_NAME}: Passwort zurücksetzen`,
    intro: "Gib diesen Code in der App ein, um dein Passwort zurückzusetzen:",
    code,
  });
}
