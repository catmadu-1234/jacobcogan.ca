import type { MediaVariant } from "@senka/core/types";
import { dominantColor } from "./color";

const WIDTHS = [480, 1200, 2400] as const;
const WEBP_QUALITY = 0.82;

/** Resized widths worth making for an image this wide: only smaller ones, but always at least 480. */
export function variantWidths(originalWidth: number): Array<480 | 1200 | 2400> {
  return WIDTHS.filter((w) => w === 480 || w < originalWidth);
}

/** Variants to store. GIFs keep only the original, because resizing would flatten the animation. */
export function plannedVariants(mime: string, width: number): MediaVariant[] {
  if (mime === "image/gif") return ["original"];
  return ["original", ...variantWidths(width).map((w) => `w${w}` as MediaVariant)];
}

/** Scales down to at most `max` wide, keeping the aspect ratio; never scales up. */
export function fitWidth(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= max) return { width, height };
  return { width: max, height: Math.max(1, Math.round((height * max) / width)) };
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

export function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function canvasToWebp(canvas: AnyCanvas): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/webp", WEBP_QUALITY),
  );
}

export function sampleColor(source: CanvasImageSource): string {
  const small = makeCanvas(16, 16);
  const ctx = small.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(source, 0, 0, 16, 16);
  return dominantColor(ctx.getImageData(0, 0, 16, 16).data);
}

export interface ImageResult {
  width: number;
  height: number;
  color: string;
  variants: Array<{ variant: MediaVariant; blob: Blob }>;
}

/** Decodes an image (honouring EXIF rotation) and makes the WebP variants; the original file is kept untouched. */
export async function makeImageVariants(file: File, mime: string): Promise<ImageResult> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const variants: ImageResult["variants"] = [{ variant: "original", blob: file }];
    for (const variant of plannedVariants(mime, bitmap.width).slice(1)) {
      const target = fitWidth(bitmap.width, bitmap.height, Number(variant.slice(1)));
      const canvas = makeCanvas(target.width, target.height);
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, target.width, target.height);
      variants.push({ variant, blob: await canvasToWebp(canvas) });
    }
    return { width: bitmap.width, height: bitmap.height, color: sampleColor(bitmap), variants };
  } finally {
    bitmap.close();
  }
}
