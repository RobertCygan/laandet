import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { mediaObjects } from "@/db/schema";
import type { Actor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { AppError } from "@/modules/errors";
import { enforceRateLimits, LIMITS } from "@/modules/ratelimit/ratelimit";
import { ImageRejected, MAX_UPLOAD_BYTES, processImage } from "./process";
import { sniffImageType } from "./sniff";
import { mediaStore } from "./store";

export type UploadedMedia = { id: string; width: number; height: number };

/** Validate, re-encode and store one listing image (P01-09). Nothing is kept if any step fails. */
export function uploadListingImage(actor: Actor, file: File): Promise<UploadedMedia> {
  return uploadImage(actor, file, "listing");
}

/**
 * Same pipeline for condition-report photos (P02-05): stored under `condition/`, visible only to the
 * uploader until attached to an entry, then only to the two booking parties.
 */
export async function uploadImage(actor: Actor, file: File, scope: "listing" | "condition"): Promise<UploadedMedia> {
  assertCan(actor, "media.upload");
  await enforceRateLimits(db, [
    {
      bucket: `upload:user:${actor.id}`,
      rule: actor.isNewAccount ? LIMITS.uploadsNew : LIMITS.uploadsEstablished,
    },
  ]);
  if (!(file instanceof File) || file.size === 0) throw new AppError("validation", "image_missing");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("validation", "image_too_large");
  const input = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(input);
  if (!type) throw new AppError("validation", "image_unsupported_type");
  // The prebuilt image library cannot decode HEIC. iPhones convert to JPEG on upload when the
  // file picker does not ask for HEIC, so this only hits files picked from a computer.
  if (type === "heic") throw new AppError("validation", "image_heic_unsupported");

  let processed;
  try {
    processed = await processImage(input);
  } catch (err) {
    if (err instanceof ImageRejected) {
      throw new AppError(
        "validation",
        err.reason === "too_large"
          ? "image_too_large"
          : err.reason === "too_many_pixels"
            ? "image_too_many_pixels"
            : "image_undecodable",
      );
    }
    throw err;
  }

  const id = randomUUID();
  const storageKey = `${scope}/${id}.webp`;
  const thumbKey = `${scope}/${id}-thumb.webp`;
  const store = mediaStore();
  await store.put(storageKey, processed.display);
  await store.put(thumbKey, processed.thumb);
  try {
    await db.insert(mediaObjects).values({
      id,
      uploadedBy: actor.id,
      scope,
      storageKey,
      thumbKey,
      mimeType: "image/webp",
      bytes: processed.display.byteLength,
      width: processed.width,
      height: processed.height,
      sha256: processed.sha256,
    });
  } catch (err) {
    await store.delete(storageKey);
    await store.delete(thumbKey);
    throw err;
  }
  return { id, width: processed.width, height: processed.height };
}
