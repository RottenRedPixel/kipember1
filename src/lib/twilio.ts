// voip.ms SMS API client

const apiUsername = process.env.VOIPMS_API_USERNAME;
const apiPassword = process.env.VOIPMS_API_PASSWORD;
const voipmsPhoneNumber = process.env.VOIPMS_DID; // Your voip.ms DID number

const VOIPMS_API_URL = 'https://voip.ms/api/v1/rest.php';

const MAX_SMS_LENGTH = 150;

function chunkMessage(message: string): string[] {
  if (message.length <= MAX_SMS_LENGTH) {
    return [message];
  }

  const parts: string[] = [];
  let remaining = message;

  while (remaining.length > 0) {
    parts.push(remaining.slice(0, MAX_SMS_LENGTH));
    remaining = remaining.slice(MAX_SMS_LENGTH);
  }

  if (parts.length === 1) {
    return parts;
  }

  return parts.map((part, index) => `(${index + 1}/${parts.length}) ${part}`);
}

export async function sendSMS(to: string, body: string): Promise<string> {
  if (!apiUsername || !apiPassword || !voipmsPhoneNumber) {
    throw new Error('voip.ms credentials not configured. Please set VOIPMS_API_USERNAME, VOIPMS_API_PASSWORD, and VOIPMS_DID.');
  }

  // Clean phone numbers (voip.ms expects 10 digits for US numbers)
  const cleanTo = to.replace(/\D/g, '').replace(/^1/, '');
  const cleanFrom = voipmsPhoneNumber.replace(/\D/g, '').replace(/^1/, '');

  const parts = chunkMessage(body);
  let lastSmsId = 'sent';

  for (let i = 0; i < parts.length; i += 1) {
    const params = new URLSearchParams({
      api_username: apiUsername,
      api_password: apiPassword,
      method: 'sendSMS',
      did: cleanFrom,
      dst: cleanTo,
      message: parts[i],
    });

    const response = await fetch(`${VOIPMS_API_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.status !== 'success') {
      console.error('voip.ms SMS error:', data);
      throw new Error(`Failed to send SMS part ${i + 1}/${parts.length}: ${data.status}`);
    }

    lastSmsId = data.sms || lastSmsId;
  }

  return lastSmsId;
}

// voip.ms webhook validation is simpler - they use a secret URL or IP whitelist
// For now, we'll trust incoming requests (you can add IP validation if needed)
export function validateWebhookRequest(): boolean {
  return true;
}

export { voipmsPhoneNumber as twilioPhoneNumber };
