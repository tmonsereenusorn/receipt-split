const TARGET_WIDTH = 1500;
const MAX_WIDTH = 2500;
const CONTRAST_FACTOR = 1.5;

/**
 * Load a File or data URL into an HTMLImageElement.
 */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));

    if (source instanceof File) {
      const url = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    } else {
      img.src = source;
    }
  });
}

/**
 * Preprocess an image for OCR: resize, grayscale, contrast boost.
 * Returns an HTMLCanvasElement ready for Tesseract.recognize().
 */
export async function preprocessImage(
  source: File | string
): Promise<HTMLCanvasElement> {
  const img = await loadImage(source);

  // Calculate target dimensions
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width < TARGET_WIDTH || width > MAX_WIDTH) {
    const targetW = width < TARGET_WIDTH ? TARGET_WIDTH : MAX_WIDTH;
    const scale = targetW / width;
    width = targetW;
    height = Math.round(height * scale);
  }

  // Draw to canvas at target size
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Grayscale + contrast boost in a single pass
  for (let i = 0; i < data.length; i += 4) {
    // Luminance grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Contrast stretch
    const adjusted = Math.min(
      255,
      Math.max(0, (gray - 128) * CONTRAST_FACTOR + 128)
    );
    data[i] = adjusted;     // R
    data[i + 1] = adjusted; // G
    data[i + 2] = adjusted; // B
    // Alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
