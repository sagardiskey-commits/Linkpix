/**
 * Utility to compress images so they fit comfortably within
 * Firestore's 1MB document limit and sync quickly across devices.
 */
export async function compressImageData(
  base64Data: string,
  maxDimension = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    // If it's already a very small data URL (< 100KB), return as is
    if (base64Data.length < 120000) {
      resolve(base64Data);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Data);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };

    img.onerror = () => {
      resolve(base64Data);
    };

    img.src = base64Data;
  });
}
