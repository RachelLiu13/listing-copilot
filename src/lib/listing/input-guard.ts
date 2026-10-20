/**
 * The seller's text is untrusted data. It is cleaned here, kept inside
 * <seller_input> tags in every prompt, and never treated as instructions.
 * Phrases that look like attempts to steer the model are flagged (and shown to
 * the user) but not executed: the model is told the block is data, and every
 * output is schema-constrained, so injected text cannot change the format or
 * reach any tool.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all |the )?(?:previous|prior|above) (?:instructions|rules)/i,
  /disregard (?:the |your )?(?:instructions|system prompt|rules)/i,
  /\b(?:system prompt|developer message|jailbreak|DAN mode)\b/i,
  /you are now (?:a|an|in)\b/i,
  /<\/?(?:system|instructions|seller_input)>/i,
  /忽略(?:以上|之前|前面|上述)(?:的)?(?:所有)?(?:指令|指示|规则|要求)/,
  /(?:系统提示|提示词)/,
  /ignora (?:las |todas las )?instrucciones (?:anteriores|previas)/i, // Spanish
  /bỏ qua (?:các |mọi )?(?:hướng dẫn|chỉ dẫn) (?:trước|trên)/i, // Vietnamese
  /(?:以前|上記|前)の指示を無視/, // Japanese
  /이전 지시(?:를|사항을)? 무시/, // Korean
];

export function clean(text: string): string {
  return text.replace(CONTROL_CHARS, "").replace(/\r\n?/g, "\n").trim();
}

export function injectionWarnings(fields: Record<string, string>): string[] {
  const warnings: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (INJECTION_PATTERNS.some((p) => p.test(value))) {
      warnings.push(`The "${name}" field contains text that looks like instructions to the AI. It was treated as product information only.`);
    }
  }
  return warnings;
}

/** Escape the tag delimiter so seller text cannot close the data block early. */
export function asDataBlock(fields: Record<string, string>): string {
  const body = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v.replace(/<\/?seller_input>/gi, "")}`)
    .join("\n");
  return `<seller_input>\n${body}\n</seller_input>`;
}
