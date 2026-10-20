import "server-only";

export type Send = (event: Record<string, unknown>) => void;

/**
 * Newline-delimited JSON stream. The worker keeps running if the browser goes
 * away, so a spent credit still ends in a saved result.
 */
export function ndjson(work: (send: Send) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: Send = (event) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // Browser disconnected.
        }
      };
      try {
        await work(send);
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
