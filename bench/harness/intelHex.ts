/**
 * Intel HEX parsing — TS port of `test/test_circuit/src/avr/intelHex.js`,
 * itself mirroring the logic in `frontend/src/utils/hexParser.ts`.
 */

/** Parse Intel HEX text into a byte-addressed program `Uint8Array`. */
export function parseIntelHex(text: string): Uint8Array {
  const bytes: number[] = [];
  let highAddr = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith(':')) continue;
    const byteCount = parseInt(line.slice(1, 3), 16);
    const addr = parseInt(line.slice(3, 7), 16);
    const type = parseInt(line.slice(7, 9), 16);
    if (type === 0) {
      const fullAddr = (highAddr << 16) | addr;
      for (let i = 0; i < byteCount; i++) {
        bytes[fullAddr + i] = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
      }
    } else if (type === 1) {
      break;
    } else if (type === 4) {
      highAddr = parseInt(line.slice(9, 13), 16);
    }
  }
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ?? 0;
  return out;
}

/** Convert a byte array into an avr8js 16-bit word array (little-endian). */
export function bytesToProgramWords(bytes: Uint8Array, wordCount = 0x8000 / 2): Uint16Array {
  const prog = new Uint16Array(wordCount);
  for (let i = 0; i < bytes.length; i += 2) {
    prog[i >> 1] = (bytes[i] || 0) | ((bytes[i + 1] || 0) << 8);
  }
  return prog;
}
