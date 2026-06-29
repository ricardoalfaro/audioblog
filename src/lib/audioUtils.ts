// iOS WebKit (standalone PWA) rejects blob: URLs for media with MEDIA_ERR_SRC_NOT_SUPPORTED.
// Converting to base64 data URL works around this.
export function audioToDataUrl(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return `data:audio/mpeg;base64,${btoa(binary)}`;
}
