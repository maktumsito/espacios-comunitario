/** Keep a document URL alive until its viewer closes, including slow PDF viewers. */
export function showPrintBlob(viewer: Window, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  try {
    viewer.location.href = url;
    viewer.focus();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  const timer = window.setInterval(() => {
    if (viewer.closed) {
      URL.revokeObjectURL(url);
      window.clearInterval(timer);
    }
  }, 1000);
}
