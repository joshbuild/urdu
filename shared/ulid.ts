// Monotonic ULIDs (https://github.com/ulid/spec): 10 chars of millisecond time, 16 chars of
// randomness, Crockford base32. IDs made in the same millisecond, or while the clock runs
// backwards, increment the previous random part, so they always sort in creation order.

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LEN = 10;
const RANDOM_LEN = 16;
const MAX_TIME = 2 ** 48 - 1;

export type RandomDigits = () => number[];

// 256 is a multiple of 32, so masking a random byte gives an unbiased base32 digit.
const cryptoDigits: RandomDigits = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(RANDOM_LEN)), (b) => b & 31);

function encodeTime(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0 || ms > MAX_TIME)
    throw new RangeError(`Bad ULID time: ${ms}`);
  let out = "";
  for (let i = 0, t = ms; i < TIME_LEN; i++, t = Math.floor(t / 32)) {
    out = ENCODING.charAt(t % 32) + out;
  }
  return out;
}

function increment(digits: number[]): number[] {
  const next = [...digits];
  for (let i = next.length - 1; i >= 0; i--) {
    if ((next[i] ?? 0) < 31) {
      next[i] = (next[i] ?? 0) + 1;
      return next;
    }
    next[i] = 0;
  }
  throw new RangeError("ULID random part overflowed within one millisecond");
}

export function monotonicUlid(random: RandomDigits = cryptoDigits): (now?: number) => string {
  let lastTime = -1;
  let lastRandom: number[] = [];
  return (now = Date.now()) => {
    encodeTime(now); // validate before touching state
    if (now > lastTime) {
      lastTime = now;
      lastRandom = random();
    } else {
      lastRandom = increment(lastRandom);
    }
    return encodeTime(lastTime) + lastRandom.map((d) => ENCODING.charAt(d)).join("");
  };
}

export const ulid = monotonicUlid();
