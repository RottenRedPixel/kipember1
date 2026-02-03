// voip.ms SMS API client

const apiUsername = process.env.VOIPMS_API_USERNAME;
const apiPassword = process.env.VOIPMS_API_PASSWORD;
const voipmsPhoneNumber = process.env.VOIPMS_DID; // Your voip.ms DID number

const VOIPMS_API_URL = 'https://voip.ms/api/v1/rest.php';

export async function sendSMS(to: string, body: string): Promise<string> {
  if (!apiUsername || !apiPassword || !voipmsPhoneNumber) {
    throw new Error('voip.ms credentials not configured. Please set VOIPMS_API_USERNAME, VOIPMS_API_PASSWORD, and VOIPMS_DID.');
  }

  // Clean phone numbers (voip.ms expects 10 digits for US numbers)
  const cleanTo = to.replace(/\D/g, '').replace(/^1/, '');
  const cleanFrom = voipmsPhoneNumber.replace(/\D/g, '').replace(/^1/, '');

  const params = new URLSearchParams({
    api_username: apiUsername,
    api_password: apiPassword,
    method: 'sendSMS',
    did: cleanFrom,
    dst: cleanTo,
    message: body,
  });

  const response = await fetch(`${VOIPMS_API_URL}?${params.toString()}`);
  const data = await response.json();

  if (data.status !== 'success') {
    console.error('voip.ms SMS error:', data);
    throw new Error(`Failed to send SMS: ${data.status}`);
  }

  return data.sms || 'sent';
}

// voip.ms webhook validation is simpler - they use a secret URL or IP whitelist
// For now, we'll trust incoming requests (you can add IP validation if needed)
export function validateWebhookRequest(): boolean {
  return true;
}

export { voipmsPhoneNumber as twilioPhoneNumber };
