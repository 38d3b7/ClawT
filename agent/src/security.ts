const MAX_INPUT_LENGTH = 100 * 1024;
const MAX_WHITESPACE_RATIO = 0.5;
const MAX_REPETITION_RATIO = 0.4;

const INJECTION_PATTERNS = [
  "ignore previous instructions",
  "ignore all previous",
  "disregard previous",
  "forget your instructions",
  "new instructions:",
  "system prompt:",
  "you are now",
  "act as if",
  "pretend you are",
  "override your",
  "ignore your training",
  "bypass your",
  "[system]",
  "<|system|>",
  "```system",
];

const SECRET_PATTERNS = [
  /0x[a-fA-F0-9]{64}/g,
  /\b(sk-[a-zA-Z0-9]{20,})\b/g,
  /\b(xox[baprs]-[a-zA-Z0-9-]+)\b/g,
  /\b(ghp_[a-zA-Z0-9]{36,})\b/g,
  /\b(gho_[a-zA-Z0-9]{36,})\b/g,
  /\b(glpat-[a-zA-Z0-9_-]{20,})\b/g,
  /\b(AKIA[0-9A-Z]{16})\b/g,
];

const BIP39_SAMPLE = new Set([
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
  "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
  "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual",
  "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance",
  "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
  "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album",
  "alcohol", "alert", "alien", "all", "alley", "allow", "almost", "alone",
  "alpha", "already", "also", "alter", "always", "amateur", "amazing", "among",
  "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle", "angry",
  "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
  "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april",
  "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor",
  "army", "around", "arrange", "arrest",
]);

export interface ValidationResult {
  valid: boolean;
  error?: string;
  injectionRisk: number;
  warnings: string[];
}

export function validateInput(input: string): ValidationResult {
  const warnings: string[] = [];
  let injectionRisk = 0;

  if (input.length > MAX_INPUT_LENGTH) {
    return { valid: false, error: `Input exceeds ${MAX_INPUT_LENGTH} bytes`, injectionRisk: 0, warnings };
  }

  if (input.includes("\0")) {
    return { valid: false, error: "Input contains null bytes", injectionRisk: 0, warnings };
  }

  const whitespaceCount = (input.match(/\s/g) || []).length;
  if (input.length > 0 && whitespaceCount / input.length > MAX_WHITESPACE_RATIO) {
    warnings.push("High whitespace ratio detected");
    injectionRisk += 0.2;
  }

  const words = input.toLowerCase().split(/\s+/);
  if (words.length > 10) {
    const uniqueWords = new Set(words);
    const repetitionRatio = 1 - uniqueWords.size / words.length;
    if (repetitionRatio > MAX_REPETITION_RATIO) {
      warnings.push("High repetition detected");
      injectionRisk += 0.3;
    }
  }

  const lowerInput = input.toLowerCase();
  for (const pattern of INJECTION_PATTERNS) {
    if (lowerInput.includes(pattern)) {
      warnings.push(`Potential injection pattern: "${pattern}"`);
      injectionRisk += 0.3;
    }
  }

  injectionRisk = Math.min(injectionRisk, 1);
  return { valid: true, injectionRisk, warnings };
}

export function sanitizeOutput(output: string): string {
  let sanitized = output;

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  const words = sanitized.toLowerCase().split(/\s+/);
  let consecBip39 = 0;
  let startIdx = -1;
  const ranges: Array<[number, number]> = [];

  for (let i = 0; i < words.length; i++) {
    if (BIP39_SAMPLE.has(words[i])) {
      if (consecBip39 === 0) startIdx = i;
      consecBip39++;
    } else {
      if (consecBip39 >= 12) {
        ranges.push([startIdx, i]);
      }
      consecBip39 = 0;
    }
  }
  if (consecBip39 >= 12) {
    ranges.push([startIdx, words.length]);
  }

  if (ranges.length > 0) {
    const originalWords = sanitized.split(/\s+/);
    for (const [start, end] of ranges) {
      for (let i = start; i < end && i < originalWords.length; i++) {
        originalWords[i] = "[REDACTED]";
      }
    }
    sanitized = originalWords.join(" ");
  }

  return sanitized;
}

export function validateSessionId(sessionId: string | undefined): string | null {
  if (!sessionId) return null;
  if (typeof sessionId !== "string") return null;
  if (sessionId.length > 64) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) return null;
  return sessionId;
}
