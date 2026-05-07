import nodemailer from 'nodemailer';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getSmtpConfig(): SmtpConfig | null {
  const user = process.env.SMTP_USERNAME || process.env.MAILGUN_SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD || process.env.MAILGUN_SMTP_PASSWORD;
  const from = process.env.SMTP_FROM_EMAIL || process.env.MAILGUN_FROM_EMAIL;

  if (!user || !pass || !from) {
    return null;
  }

  const host =
    process.env.SMTP_HOST ||
    (process.env.MAILGUN_SMTP_USERNAME ? 'smtp.mailgun.org' : null);

  if (!host) {
    return null;
  }

  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user,
    pass,
    from,
  };
}

export function isEmailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getSmtpConfig();
  if (!config) {
    throw new Error(
      'SMTP is not configured. Set SMTP_* or MAILGUN_SMTP_* environment variables.'
    );
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
}

export async function sendEmail(payload: EmailPayload) {
  // Email temporarily disabled — delete these two lines and uncomment the block below to re-enable
  console.log(`[sendEmail disabled] to=${payload.to} subject=${payload.subject}`);
  return;

  /* RE-ENABLE: remove the two lines above and uncomment this block
  const config = getSmtpConfig();
  if (!config) {
    throw new Error(
      'SMTP is not configured. Set SMTP_* or MAILGUN_SMTP_* environment variables.'
    );
  }

  await getTransporter().sendMail({
    from: config.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
  */
}
