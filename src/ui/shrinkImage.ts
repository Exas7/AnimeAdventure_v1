import { KEEPER_IMAGE_SIZE } from '../catalog/specialKeepers';

/**
 * Reads a picture chosen by the host and shrinks it so that its longest side
 * is at most `size` pixels (D-035): it travels in files and to the stream.
 * WebP keeps transparent backgrounds, and the app runs in Chrome (D-022).
 * Rejects when the file is not a readable picture.
 */
export async function shrinkImage(file: File, size = KEEPER_IMAGE_SIZE): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Il browser non riesce a preparare l’immagine.');
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.9);
  } finally {
    bitmap.close();
  }
}
