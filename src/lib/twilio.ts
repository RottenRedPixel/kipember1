// voip.ms SMS API client

const apiUsername = process.env.VOIPMS_API_USERNAME;
const apiPassword = process.env.VOIPMS_API_PASSWORD;
const voipmsPhoneNumber = process.env.VOIPMS_DID; // Your voip.ms DID number

const VOIPMS_API_URL = 'https://voip.ms/api/v1/rest.php';

function parseProviderPayload(body: string): Record<string, unknown> | null {
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

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
    content_type: 'json',
    did: cleanFrom,
    dst: cleanTo,
    message: body,
  });

  const response = await fetch(`${VOIPMS_API_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  });
  const rawBody = await response.text();
  const data = parseProviderPayload(rawBody);

  if (!response.ok) {
    const providerStatus =
      (data?.status as string | undefined) ||
      `HTTP ${response.status}`;
    const providerMessage =
      (data?.message as string | undefined) ||
      rawBody.slice(0, 180).trim() ||
      'Unknown provider error';

    console.error('voip.ms SMS HTTP error:', {
      httpStatus: response.status,
      providerStatus,
      providerMessage,
    });
    throw new Error(`Failed to send SMS: ${providerStatus} - ${providerMessage}`);
  }

  if (!data) {
    throw new Error(
      `Failed to send SMS: Invalid provider response (${response.headers.get('content-type') || 'unknown content type'})`
    );
  }

  if (data.status !== 'success') {
    console.error('voip.ms SMS error:', data);
    const providerMessage =
      (data.message as string | undefined) ||
      (data.error as string | undefined) ||
      'Unknown provider error';
    throw new Error(`Failed to send SMS: ${String(data.status)} - ${providerMessage}`);
  }

  return typeof data.sms === 'string' ? data.sms : 'sent';
}

// voip.ms webhook validation is simpler - they use a secret URL or IP whitelist
// For now, we'll trust incoming requests (you can add IP validation if needed)
export function validateWebhookRequest(): boolean {
  return true;
}

export { voipmsPhoneNumber as twilioPhoneNumber };
