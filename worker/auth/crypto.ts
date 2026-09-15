// Secret comparison and session tokens (FR-B1, FR-B4).

export const MIN_SECRET_LENGTH = 24;

const encoder = new TextEncoder();

async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(text));
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new Uint8Array(await sha256(text));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Hashing both sides first gives equal-length inputs, so the compare leaks neither the
// secret's length nor where the first mismatch is.
export async function secretMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// 32 random bytes as base64url (43 chars). Only its SHA-256 is stored.
export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
