# P01-09 — Image upload pipeline and media delivery

## GOAL
Users can add photos to listings safely. Every stored image is re-encoded, stripped of metadata (including GPS),
stored under a random key and delivered only to people allowed to see it.

## CONTEXT
- Requirements: SEC-30…34, D-006, `ARCHITECTURE.md` §4.6, threat TH-08.
- Condition and dispute photos (Phase 02/03) reuse this pipeline with private scopes.

## INPUT
- `sharp` 0.35.x.
- Table `media_objects`.
- `MEDIA_DIR` (Docker volume).
- Limits:
  - 10 MB per file
  - 8 images per listing
  - 40 megapixels input
  - output WebP at 1 600 px long edge plus a 480 px thumbnail

## OUTPUT
1. `src/modules/media/`:
   - `sniffImageType(bytes)`: magic bytes for JPEG, PNG, WebP and HEIC/HEIF. Anything else is rejected, including SVG, GIF, PDF and HTML.
   - `processImage(stream)`: streaming size guard, then sharp with `limitInputPixels: 40_000_000` and `failOn: 'error'`, then `.rotate()`, then resize, then `.webp({ quality: 80 })`. **Metadata is not kept.**
   - `MediaStore` interface plus a `DiskMediaStore` that writes atomically (temp file + rename) under `MEDIA_DIR/<scope>/<uuid>.webp`.
   - The SHA-256 of the output bytes is stored with the `media_objects` row.
2. Upload Server Action used by the listing wizard. It returns media ids for the draft listing. Users can reorder images, delete them and add alt text.
3. Route `src/app/media/[key]/route.ts`:
   - looks up the `media_objects` row and the owning resource, then authorises:
     - `listing`: the listing is published, or the actor is its owner;
     - `condition` / `dispute`: denied in Phase 01;
   - streams the file with `Content-Type: image/webp`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`;
   - cache headers: `Cache-Control: public, max-age=86400` for published listing images, `private, no-store` otherwise;
   - unknown or unauthorised keys → 404.
4. Worker job: delete orphaned uploads (not attached to a listing within 24 h), both file and row.
5. A clear user message if HEIC is not decodable on the server build: «Bildet kunne ikke leses. Prøv å ta bildet på nytt, eller lagre det som JPEG.»

## CONSTRAINTS
- Never trust the client MIME type or file extension.
- Never write the original upload to permanent storage.
- Never serve files from a public static directory.
- Uploads count against rate limits (SEC §2).

## TESTS (acceptance criteria)
1. **Integration:** a valid JPEG, PNG and WebP are each accepted. The stored file is WebP, ≤ 1 600 px on the long edge, and a thumbnail exists.
2. **Integration (SEC-32):** a fixture JPEG with GPS EXIF is uploaded. Reading the stored file with `sharp(...).metadata()` shows no `exif`, `xmp` or `iptc`, and no GPS.
3. **Integration (N8):** rejected with a friendly error, and no file or row is left behind, for each of these:
   - an `.svg` containing `<script>`
   - an HTML file renamed to `.jpg`
   - a JPEG/HTML polyglot (passes only if re-encoded; the output contains no HTML)
   - a 12 MB file
   - a 50-megapixel PNG decompression bomb
   - a 9th image
4. **Integration:** the image of a draft listing → 404 for another user and 200 for the owner. After publishing → 200 for anyone.
5. **Integration:** an orphaned upload is removed by the worker job after 24 h (time is mocked in the test).
