// ==========================================
// CONSTANTS
// ==========================================

const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_IMAGE_QUALITY = 0.80;
const BYTES_PER_KILOBYTE = 1024;
const SIZE_UNITS: readonly string[] = Object.freeze(['B', 'KB', 'MB', 'GB']);

/**
 * Calculates resized dimensions maintaining aspect ratio within maximum bounds.
 */
function calculateScaledDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  if (originalWidth > originalHeight) {
    return {
      width: maxWidth,
      height: Math.round((originalHeight * maxWidth) / originalWidth)
    };
  }

  return {
    width: Math.round((originalWidth * maxHeight) / originalHeight),
    height: maxHeight
  };
}

/**
 * Compresses an image file to a base64 DataURL with a maximum dimension and quality.
 *
 * @param file - The source image File.
 * @param maxWidth - Maximum allowable width in pixels.
 * @param maxHeight - Maximum allowable height in pixels.
 * @param quality - JPEG compression quality between 0.0 and 1.0.
 * @returns Promise resolving to the compressed image DataURL.
 */
export async function compressImageToDataUrl(
  file: File,
  maxWidth: number = DEFAULT_MAX_DIMENSION,
  maxHeight: number = DEFAULT_MAX_DIMENSION,
  quality: number = DEFAULT_IMAGE_QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onerror = () => {
      reject(new Error(`Failed to read file "${file.name}"`));
    };

    fileReader.onload = () => {
      const sourceUrl = fileReader.result as string;
      const imageElement = new Image();

      imageElement.onerror = () => {
        reject(new Error(`Failed to decode image data from file "${file.name}"`));
      };

      imageElement.onload = () => {
        const { width, height } = calculateScaledDimensions(
          imageElement.width,
          imageElement.height,
          maxWidth,
          maxHeight
        );

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const renderingContext = canvas.getContext('2d');
        if (!renderingContext) {
          // Fallback: return original data URL if 2D context is unavailable
          resolve(sourceUrl);
          return;
        }

        renderingContext.drawImage(imageElement, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      imageElement.src = sourceUrl;
    };

    fileReader.readAsDataURL(file);
  });
}

/**
 * Reads any file (such as a PDF or text document) into a base64 DataURL.
 *
 * @param file - The source file to read.
 * @returns Promise resolving to the base64 DataURL string.
 */
export async function readFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => resolve(fileReader.result as string);
    fileReader.onerror = () => reject(new Error(`Unable to read file "${file.name}"`));
    fileReader.readAsDataURL(file);
  });
}

/**
 * Formats a byte count into a human-readable size string (e.g., "1.4 MB", "512 KB").
 *
 * @param bytes - Number of bytes to format.
 * @param decimalPlaces - Number of decimal points to display (defaults to 1).
 */
export function formatBytes(bytes: number, decimalPlaces: number = 1): string {
  if (!bytes || bytes <= 0) {
    return '0 B';
  }

  const precision = Math.max(0, decimalPlaces);
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(BYTES_PER_KILOBYTE)),
    SIZE_UNITS.length - 1
  );

  const scaledValue = bytes / Math.pow(BYTES_PER_KILOBYTE, unitIndex);
  return `${parseFloat(scaledValue.toFixed(precision))} ${SIZE_UNITS[unitIndex]}`;
}
