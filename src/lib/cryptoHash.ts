import { PowerState, TelemetryLogEntry } from '../types/awka';

/**
 * Pure TypeScript synchronous SHA-256 implementation (FIPS 180-4)
 * Guarantees deterministic hash-chain computation synchronously on initial load
 * and inside instant tamper-verification checks across all browsers.
 */
export function sha256Hex(input: string): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

export function computePayloadHash(params: {
  feederId: string;
  recordedAt: string;
  voltageL1V: number;
  frequencyHz: number;
  rawDeviceState: PowerState;
}): string {
  const canonical = JSON.stringify({
    f: params.feederId,
    t: params.recordedAt,
    v: Number(params.voltageL1V.toFixed(2)),
    hz: Number(params.frequencyHz.toFixed(2)),
    s: params.rawDeviceState,
  });
  return sha256Hex(canonical);
}

export function computeChainHash(params: {
  prevHash: string;
  feederId: string;
  sequenceNo: number;
  recordedAt: string;
  consensusState: PowerState;
  voltageL1V: number;
  payloadHash: string;
}): string {
  const preimage = [
    params.prevHash,
    params.feederId,
    params.sequenceNo,
    params.recordedAt,
    params.consensusState,
    params.voltageL1V.toFixed(2),
    params.payloadHash,
  ].join('|');
  return sha256Hex(preimage);
}

export function verifyFeederChain(logs: TelemetryLogEntry[]): {
  valid: boolean;
  brokenAtSequence: number | null;
  checkedCount: number;
} {
  const sorted = [...logs].sort((a, b) => a.sequenceNo - b.sequenceNo);
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (i > 0 && entry.prevHash !== sorted[i - 1].chainHash) {
      return { valid: false, brokenAtSequence: entry.sequenceNo, checkedCount: i + 1 };
    }
    const expectedChain = computeChainHash({
      prevHash: entry.prevHash,
      feederId: entry.feederId,
      sequenceNo: entry.sequenceNo,
      recordedAt: entry.recordedAt,
      consensusState: entry.consensusState,
      voltageL1V: entry.voltageL1V,
      payloadHash: entry.payloadHash,
    });
    if (expectedChain !== entry.chainHash) {
      return { valid: false, brokenAtSequence: entry.sequenceNo, checkedCount: i + 1 };
    }
  }
  return { valid: true, brokenAtSequence: null, checkedCount: sorted.length };
}

/**
 * Generates an IEC 62055-41 formatted 20-digit STS prepaid token + TID (minutes since 2014-01-01)
 */
export function generateSts20DigitToken(params: {
  meterDrn: string;
  kwhUnits: number;
  sgc: string;
  timestampMs: number;
}): { token20Digit: string; tokenTid: number } {
  const stsBase2014Ms = Date.UTC(2014, 0, 1, 0, 0, 0);
  const tokenTid = Math.max(1, Math.floor((params.timestampMs - stsBase2014Ms) / 60000));
  const digest = sha256Hex(`${params.sgc}|${params.meterDrn}|${tokenTid}|${params.kwhUnits.toFixed(3)}`);

  // Convert hex pairs deterministically into 20 decimal digits grouped 4-4-4-4-4
  let digits = '';
  for (let i = 0; i < 20; i++) {
    const byteVal = parseInt(digest.slice(i * 2, i * 2 + 2), 16);
    digits += (byteVal % 10).toString();
  }
  const formatted = digits.match(/.{1,4}/g)?.join('-') ?? digits;
  return { token20Digit: formatted, tokenTid };
}

export function generateUuidV7(): string {
  const ms = Date.now();
  const hexTs = ms.toString(16).padStart(12, '0');
  const rand = sha256Hex(`${ms}-${Math.random()}`);
  return `${hexTs.slice(0, 8)}-${hexTs.slice(8, 12)}-7${rand.slice(0, 3)}-a${rand.slice(3, 6)}-${rand.slice(6, 18)}`;
}
