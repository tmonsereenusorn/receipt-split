// Google Vision performs well at 1500px; higher adds bandwidth without accuracy gain
const MAX_WIDTH = 1500;

/**
 * Load a File or data URL into an HTMLImageElement.
 */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

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
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = source;
    }
  });
}

/**
 * Resize image if wider than MAX_WIDTH and return as a JPEG base64 data URL.
 * Also handles HEIC/any format by re-encoding through canvas.
 */
export async function prepareImageBase64(
  source: File | string
): Promise<string> {
  const img = await loadImage(source);

  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width > MAX_WIDTH) {
    const scale = MAX_WIDTH / width;
    width = MAX_WIDTH;
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  ctx.drawImage(img, 0, 0, width, height);

  // Balance between file size and OCR accuracy
  const JPEG_QUALITY = 0.85;
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
