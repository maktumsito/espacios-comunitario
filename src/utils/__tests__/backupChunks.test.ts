import { expect, it } from 'vitest';
import { splitBackupPayload } from '../backupChunks';
it('preserves Unicode and escaping while respecting serialized byte limits',()=> {
  const payload = '漢字😀\n"\\'.repeat(500);
  const chunks=splitBackupPayload(payload,200,180);
  expect(chunks.join('')).toBe(payload);
  expect(chunks.every(chunk=>new TextEncoder().encode(JSON.stringify(chunk)).byteLength<=180)).toBe(true);
  expect(chunks.every(chunk=>!/[\uD800-\uDBFF]$/.test(chunk))).toBe(true);
});
