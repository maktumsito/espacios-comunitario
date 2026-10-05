/** Bound the serialized field in bytes, including JSON escaping and Unicode. */
export function splitBackupPayload(payload: string, maxCharacters = 400_000, maxBytes = 800_000): string[] {
  const encoder = new TextEncoder();
  const size = (value: string) => encoder.encode(JSON.stringify(value)).byteLength;
  const chunks: string[] = [];
  for (let start = 0; start < payload.length;) {
    let end = Math.min(payload.length, start + maxCharacters);
    if (size(payload.slice(start,end)) > maxBytes) {
      let low = start + 1, high = end;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (size(payload.slice(start,middle)) <= maxBytes) low = middle; else high = middle - 1;
      }
      end = low;
    }
    const last = payload.charCodeAt(end-1);
    if (end < payload.length && last >= 0xD800 && last <= 0xDBFF) end--;
    if (end <= start || size(payload.slice(start,end)) > maxBytes) throw new Error('El tamaño máximo del fragmento es insuficiente.');
    chunks.push(payload.slice(start,end)); start = end;
  }
  return chunks.length ? chunks : [''];
}
