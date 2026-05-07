// Custom Next.js server — adds WebSocket support for Retell Custom LLM agents.
//
// Retell connects via WebSocket to /api/retell/llm[?role=owner|contributor].
// This server handles the WS upgrade, receives Retell turn messages, converts
// them to our existing OpenAI-compatible SSE format, calls our own HTTP
// endpoint locally, and streams the tokens back over WebSocket.
//
// The HTTP handler at /api/retell/llm continues to handle all LLM logic
// (prompts, DB, Claude) — this file is purely a protocol bridge.

import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT ?? '3000', 10);

// ─── Retell WS message types ─────────────────────────────────────────────────

interface RetellTurn {
  role: 'agent' | 'user';
  content: string;
}

interface RetellInbound {
  interaction_type: string;
  response_id?: number;
  transcript?: RetellTurn[];
  call?: {
    call_id?: string;
    metadata?: Record<string, string>;
    retell_llm_dynamic_variables?: Record<string, string>;
  };
}

// ─── WebSocket → HTTP proxy ───────────────────────────────────────────────────

async function handleRetellWebSocket(ws: WebSocket, req: IncomingMessage) {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const roleParam = url.searchParams.get('role') ?? '';

  ws.on('error', (err) => console.error('[retell-ws] error:', err.message));

  ws.on('message', async (raw) => {
    let msg: RetellInbound;
    try {
      msg = JSON.parse(raw.toString()) as RetellInbound;
    } catch {
      return;
    }

    if (msg.interaction_type === 'ping_pong') {
      ws.send(JSON.stringify({ interaction_type: 'ping_pong' }));
      return;
    }

    if (
      msg.interaction_type !== 'response_required' &&
      msg.interaction_type !== 'reminder_required'
    ) {
      return;
    }

    const responseId = msg.response_id ?? 0;

    // Convert Retell transcript → OpenAI messages array
    const messages = (msg.transcript ?? [])
      .filter((t) => t.content?.trim())
      .map((t) => ({
        role: t.role === 'agent' ? 'assistant' : 'user',
        content: t.content.trim(),
      }));

    // Proxy to our own HTTP endpoint (/api/retell/llm) on localhost
    const llmPath = `/api/retell/llm${roleParam ? `?role=${roleParam}` : ''}`;
    const body = JSON.stringify({ messages, call: msg.call ?? {}, stream: true });

    let response: Response;
    try {
      response = await fetch(`http://localhost:${port}${llmPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (err) {
      console.error('[retell-ws] fetch error:', err);
      if (ws.readyState === ws.OPEN) {
        ws.send(
          JSON.stringify({
            response_id: responseId,
            content: "Sorry, I'm having trouble right now.",
            content_complete: true,
          })
        );
      }
      return;
    }

    if (!response.ok || !response.body) {
      if (ws.readyState === ws.OPEN) {
        ws.send(
          JSON.stringify({ response_id: responseId, content: "Sorry, couldn't get a response.", content_complete: true })
        );
      }
      return;
    }

    // Parse SSE stream → WebSocket messages
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (ws.readyState !== ws.OPEN) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            if (ws.readyState === ws.OPEN) {
              ws.send(
                JSON.stringify({ response_id: responseId, content: '', content_complete: true })
              );
            }
            continue;
          }
          try {
            const chunk = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const text = chunk.choices?.[0]?.delta?.content ?? '';
            if (text && ws.readyState === ws.OPEN) {
              ws.send(
                JSON.stringify({ response_id: responseId, content: text, content_complete: false })
              );
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch (err) {
      console.error('[retell-ws] stream read error:', err);
    } finally {
      reader.releaseLock();
    }
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function main() {
  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true);
    void handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = parse(req.url ?? '/').pathname ?? '';
    if (pathname.startsWith('/api/retell/llm')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        void handleRetellWebSocket(ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} [custom server + retell-ws]`);
  });
}

void main().catch((err: unknown) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
