import { createHash } from "node:crypto";
import sharp, { type Sharp } from "sharp";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 40_000_000;
const DISPLAY_EDGE = 1600;
const THUMB_EDGE = 480;

export type ProcessedImage = {
  display: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  sha256: string;
};

export class ImageRejected extends Error {
  constructor(public readonly reason: "too_large" | "unsupported_type" | "undecodable" | "too_many_pixels") {
    super(reason);
  }
}

/**
 * Decode under a pixel limit, auto-rotate, drop ALL metadata (EXIF incl. GPS, XMP, IPTC)
 * and re-encode to WebP (SEC-32). Re-encoding also neutralises polyglot payloads.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new ImageRejected("too_large");
  let base: Sharp;
  try {
    base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
    const meta = await base.metadata();
    if (!meta.width || !meta.height) throw new ImageRejected("undecodable");
  } catch (err) {
    if (err instanceof ImageRejected) throw err;
    const msg = err instanceof Error ? err.message : "";
    if (/pixel limit/i.test(msg)) throw new ImageRejected("too_many_pixels");
    throw new ImageRejected("undecodable");
  }
  try {
    const display = await base
      .clone()
      .resize({ width: DISPLAY_EDGE, height: DISPLAY_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base
      .clone()
      .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    return {
      display: display.data,
      thumb,
      width: display.info.width,
      height: display.info.height,
      sha256: createHash("sha256").update(display.data).digest("hex"),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/pixel limit/i.test(msg)) throw new ImageRejected("too_many_pixels");
    throw new ImageRejected("undecodable");
  }
}
