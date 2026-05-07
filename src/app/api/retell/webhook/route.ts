import { NextRequest, NextResponse } from 'next/server';
import { verifyRetellSignature } from '@/lib/retell';
import { processRetellWebhook } from '@/lib/voice-calls';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get('x-retell-signature') ||
      request.headers.get('x-retell-signature-v2');

    const isValid = await verifyRetellSignature(rawBody, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Retell signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as unknown;
    await processRetellWebhook(payload).catch((error) => {
      console.error('Retell webhook processing error:', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Retell webhook error:', error);
    return NextResponse.json({ success: true });
  }
}
