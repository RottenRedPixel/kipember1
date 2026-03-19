import { getAppBaseUrl } from '@/lib/app-url';
import { sendEmail } from '@/lib/email';

function resolveBaseUrl(baseUrl?: string) {
  return (baseUrl || getAppBaseUrl()).replace(/\/$/, '');
}

function buildEmailShell({
  eyebrow,
  title,
  body,
  buttonLabel,
  buttonHref,
  finePrint,
}: {
  eyebrow: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
  finePrint: string;
}) {
  return {
    text: `${eyebrow}\n\n${title}\n\n${body}\n\n${buttonLabel}: ${buttonHref}\n\n${finePrint}`,
    html: `
      <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f7f5;padding:32px;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid rgba(17,17,17,0.08);border-radius:24px;padding:32px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#ff6621;">${eyebrow}</div>
          <h1 style="margin:16px 0 0;font-size:32px;line-height:1.1;color:#111111;">${title}</h1>
          <p style="margin:16px 0 0;font-size:15px;line-height:1.8;color:#555555;">${body}</p>
          <div style="margin-top:28px;">
            <a href="${buttonHref}" style="display:inline-block;background:#ff6621;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:600;">${buttonLabel}</a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#777777;">${finePrint}</p>
        </div>
      </div>
    `,
  };
}

export async function sendMagicLinkEmail({
  email,
  token,
  mode,
  ttlMinutes,
  baseUrl,
}: {
  email: string;
  token: string;
  mode: 'login' | 'signup';
  ttlMinutes: number;
  baseUrl?: string;
}) {
  const href = `${resolveBaseUrl(baseUrl)}/magic-link?token=${encodeURIComponent(token)}`;
  const shell = buildEmailShell({
    eyebrow: mode === 'signup' ? 'Finish signup' : 'Magic link',
    title: mode === 'signup' ? 'Finish creating your Ember account' : 'Sign in to Ember',
    body:
      mode === 'signup'
        ? 'Use this secure link to finish creating your Ember account and open your memories.'
        : 'Use this secure link to sign in to Ember without entering your password.',
    buttonLabel: mode === 'signup' ? 'Create account' : 'Sign in',
    buttonHref: href,
    finePrint: `This link expires in ${ttlMinutes} minutes. If you did not request it, you can ignore this email.`,
  });

  await sendEmail({
    to: email,
    subject: mode === 'signup' ? 'Finish creating your Ember account' : 'Your Ember sign-in link',
    text: shell.text,
    html: shell.html,
  });
}

export async function sendPasswordResetEmail({
  email,
  token,
  ttlMinutes,
  baseUrl,
}: {
  email: string;
  token: string;
  ttlMinutes: number;
  baseUrl?: string;
}) {
  const href = `${resolveBaseUrl(baseUrl)}/reset-password?token=${encodeURIComponent(token)}`;
  const shell = buildEmailShell({
    eyebrow: 'Password reset',
    title: 'Reset your Ember password',
    body: 'Use this secure link to choose a new password for your Ember account.',
    buttonLabel: 'Reset password',
    buttonHref: href,
    finePrint: `This link expires in ${ttlMinutes} minutes. If you did not request it, you can ignore this email.`,
  });

  await sendEmail({
    to: email,
    subject: 'Reset your Ember password',
    text: shell.text,
    html: shell.html,
  });
}

export async function sendFriendRequestEmail({
  toEmail,
  requesterName,
}: {
  toEmail: string;
  requesterName: string;
}) {
  const href = `${getAppBaseUrl()}/profile`;
  const shell = buildEmailShell({
    eyebrow: 'Friend request',
    title: `${requesterName} wants to connect on Ember`,
    body: 'Open your Ember profile to review the request and add them to your network.',
    buttonLabel: 'Open Ember',
    buttonHref: href,
    finePrint: 'If you are not signed in, Ember will ask you to log in first.',
  });

  await sendEmail({
    to: toEmail,
    subject: `${requesterName} sent you an Ember friend request`,
    text: shell.text,
    html: shell.html,
  });
}
