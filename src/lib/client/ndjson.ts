/** Reads a newline-delimited JSON response, calling onEvent for each event. Returns true if a terminal event arrived. */
export async function readNdjson(res: Response, onEvent: (event: Record<string, unknown>) => boolean | void): Promise<boolean> {
  if (!res.body) return false;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      if (onEvent(JSON.parse(line)) === true) return true;
    }
  }
  return false;
}

export const MARKETS = [
  { id: "amazon_us", label: "Amazon US" },
  { id: "tiktok_us", label: "TikTok Shop US" },
  { id: "amazon_uk", label: "Amazon UK" },
  { id: "amazon_de", label: "Amazon DE (German)" },
  { id: "amazon_jp", label: "Amazon JP (Japanese)" },
] as const;
export type MarketId = (typeof MARKETS)[number]["id"];
