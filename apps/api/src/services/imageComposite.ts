/**
 * imageComposite.ts
 *
 * Adds a circular thumbnail overlay (from the edited image itself) onto the
 * main output image, positioned top-left with a white border ring.
 *
 * Requirements 27-32:
 *  - Same editing rules applied to circular element (inherited: it IS the edited image)
 *  - White outline always visible
 *  - Top-left placement, staying within bounds
 *  - Sharp, high-quality output
 *  - Visual consistency between main and circle (both derived from the same source)
 */
import sharp from 'sharp';

interface CompositeOptions {
  /** Diameter of the circular thumbnail (px). Default 210 */
  circleSize?: number;
  /** White border thickness (px). Default 6 */
  borderPx?: number;
  /** Left offset from edge (px). Default 28 */
  posX?: number;
  /** Top offset from edge (px). Default 28 */
  posY?: number;
}

/**
 * Decode a data URL or plain base64 string into a Buffer.
 */
function decodeBase64Image(src: string): { buffer: Buffer; mime: string } {
  if (src.startsWith('data:')) {
    const [header, b64] = src.split(',');
    const mime = header.replace('data:', '').replace(';base64', '');
    return { buffer: Buffer.from(b64, 'base64'), mime };
  }
  // Assume PNG if raw base64
  return { buffer: Buffer.from(src, 'base64'), mime: 'image/png' };
}

/**
 * Given the final edited image as a base64 data URL, composite a circular
 * thumbnail of that same image in the top-left area with a white ring border.
 *
 * Returns the final composite as a base64 PNG data URL.
 */
export async function addCircularOverlay(
  editedImageDataUrl: string,
  options: CompositeOptions = {}
): Promise<string> {
  const {
    circleSize = 210,
    borderPx = 6,
    posX = 28,
    posY = 28,
  } = options;

  const { buffer: mainBuf } = decodeBase64Image(editedImageDataUrl);

  // ── Step 1: Resize the edited image to a square for the circular thumbnail ──
  const thumbBuf = await sharp(mainBuf)
    .resize(circleSize, circleSize, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  // ── Step 2: Create an SVG circular mask (white circle = keep, black = cut) ─
  const circleMask = Buffer.from(
    `<svg width="${circleSize}" height="${circleSize}">
       <circle cx="${circleSize / 2}" cy="${circleSize / 2}" r="${circleSize / 2}" fill="white"/>
     </svg>`
  );

  // ── Step 3: Clip the thumbnail to a circle using the mask ──────────────────
  const clippedThumb = await sharp(thumbBuf)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // ── Step 4: Build a white-ring container (circle + border) ─────────────────
  const totalSize = circleSize + borderPx * 2;
  const whiteDisk = Buffer.from(
    `<svg width="${totalSize}" height="${totalSize}">
       <circle cx="${totalSize / 2}" cy="${totalSize / 2}" r="${totalSize / 2}" fill="white"/>
     </svg>`
  );

  const ringWithThumb = await sharp({
    create: { width: totalSize, height: totalSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: whiteDisk, top: 0, left: 0, blend: 'over' },
      { input: clippedThumb, top: borderPx, left: borderPx, blend: 'over' },
    ])
    .png()
    .toBuffer();

  // ── Step 5: Composite the circular element onto the main edited image ───────
  const finalBuf = await sharp(mainBuf)
    .composite([{ input: ringWithThumb, top: posY, left: posX, blend: 'over' }])
    .png()
    .toBuffer();

  return `data:image/png;base64,${finalBuf.toString('base64')}`;
}
