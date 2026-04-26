
export function decodeJwtPayload<T = Record<string, unknown>>(token: string | null | undefined): T | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const payload = parts[1];
  if (!payload) {
    return null;
  }

  try {
    const base64 = base64UrlToBase64(payload);
    const binary = atob(base64);
    const json = binaryToUtf8String(binary);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function base64UrlToBase64(input: string): string {
  const replaced = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (replaced.length % 4)) % 4;
  return replaced + '='.repeat(padLength);
}

function binaryToUtf8String(binary: string): string {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  // Fallback for environments without TextDecoder (very old browsers / some SSR setups)
  return decodeURIComponent(
    Array.from(bytes)
      .map(b => '%' + b.toString(16).padStart(2, '0'))
      .join('')
  );
}
