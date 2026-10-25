import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/modules/config/env";

/** Storage behind the app (DECISIONS D-006). An S3-compatible adapter can implement the same interface. */
export interface MediaStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

const KEY_RE = /^(listing|condition|dispute)\/[0-9a-f-]{36}(-thumb)?\.webp$/;

export function assertValidKey(key: string): void {
  if (!KEY_RE.test(key)) throw new Error("invalid media key");
}

export class DiskMediaStore implements MediaStore {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    assertValidKey(key);
    return path.join(this.root, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, data, { mode: 0o640 });
    await rename(tmp, target);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

let store: MediaStore | undefined;
export function mediaStore(): MediaStore {
  store ??= new DiskMediaStore(path.resolve(env().MEDIA_DIR));
  return store;
}
