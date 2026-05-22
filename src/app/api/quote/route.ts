import { orchestrateQuote } from '@/lib/quote/orchestrator';
import type { StreamEvent } from '@/types/quote';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  prompt: z.string().min(2).max(500),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be JSON.', 400);
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 422);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeSend = (event: StreamEvent) => {
        // SSE wire format: "event: <name>\ndata: <json>\n\n"
        const wire = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(wire));
        } catch {
          // Client disconnected; downstream sends will no-op.
        }
      };

      // Initial comment frame keeps proxies / browsers from buffering.
      controller.enqueue(encoder.encode(': open\n\n'));

      const aborted = request.signal;
      const onAbort = () => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      aborted.addEventListener('abort', onAbort);

      try {
        for await (const event of orchestrateQuote({ prompt: parsed.data.prompt })) {
          if (aborted.aborted) break;
          safeSend(event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        safeSend({ type: 'error', phase: 'done', message });
      } finally {
        aborted.removeEventListener('abort', onAbort);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
