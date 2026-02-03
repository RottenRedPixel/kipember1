import { NextRequest, NextResponse } from 'next/server';
import { handleIncomingMessage } from '@/lib/interview';
import { sendSMS } from '@/lib/twilio';

// Handle both GET and POST for voip.ms compatibility
export async function GET(request: NextRequest) {
  return handleWebhook(request);
}

export async function POST(request: NextRequest) {
  return handleWebhook(request);
}

async function handleWebhook(request: NextRequest) {
  try {
    // voip.ms sends params via query string (GET) or form data (POST)
    let from: string | null = null;
    let body: string | null = null;

    // Try query params first (voip.ms typically uses GET with query params)
    const { searchParams } = new URL(request.url);
    from = searchParams.get('from') || searchParams.get('From');
    body = searchParams.get('message') || searchParams.get('Body');

    // If not in query params, try form data (for POST)
    if (!from || !body) {
      try {
        const formData = await request.formData();
        from = from || (formData.get('from') as string) || (formData.get('From') as string);
        body = body || (formData.get('message') as string) || (formData.get('Body') as string);
      } catch {
        // Ignore form parsing errors
      }
    }

    // Also try JSON body
    if (!from || !body) {
      try {
        const json = await request.clone().json();
        from = from || json.from || json.From;
        body = body || json.message || json.Body;
      } catch {
        // Ignore JSON parsing errors
      }
    }

    if (!from || !body) {
      console.log('Webhook received but missing from/body:', { from, body });
      return NextResponse.json({ status: 'ok', message: 'No message to process' });
    }

    console.log(`Incoming SMS from ${from}: ${body}`);

    const response = await handleIncomingMessage(from, body);

    // Send reply via voip.ms API (voip.ms doesn't support inline replies like Twilio)
    try {
      const cleanFrom = from.replace(/\D/g, '');
      const formattedFrom = cleanFrom.length === 10 ? `+1${cleanFrom}` : `+${cleanFrom}`;
      await sendSMS(formattedFrom, response);
    } catch (smsError) {
      console.error('Failed to send reply SMS:', smsError);
    }

    return NextResponse.json({ status: 'success', response });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error', message: 'Internal error' }, { status: 500 });
  }
}
