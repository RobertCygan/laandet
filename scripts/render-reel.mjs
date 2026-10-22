/** Render a ten-second portrait film from the actual portable HTML. */
import { chromium } from "playwright";
import { resolveBrowser } from "./browser.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputFlag = process.argv.indexOf("--input");
const input =
  inputFlag < 0
    ? path.join(root, "Laanndet.html")
    : path.resolve(process.argv[inputFlag + 1]);
const work = path.join(root, "out/reel");
const output = path.join(root, "promo");
await mkdir(work, { recursive: true });
await mkdir(output, { recursive: true });
const binary = await resolveBrowser();
const browser = await chromium.launch({
  executablePath: binary.executablePath,
  args: binary.args,
});

function command(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-y", ...args],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });
}

try {
  // Capture the supplied HTML rather than substituting a newly built website.
  const context = await browser.newContext({
    viewport: { width: 430, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    offline: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(input).href);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelector("#standalone-export-controls")?.remove();
    for (const element of document.querySelectorAll(
      '[id^="standalone-export"]',
    ))
      element.remove();
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });
  await page.screenshot({ path: path.join(work, "home.png") });
  const hero = await page.locator(".hero-visual img").getAttribute("src");
  await page.goto(pathToFileURL(input).href + "#/utforsk");
  await page.getByTestId("listing-card").first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const element of document.querySelectorAll(
      '[id^="standalone-export"]',
    ))
      element.remove();
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });
  await page.screenshot({ path: path.join(work, "browse.png") });
  const cards = page.getByTestId("listing-card");
  const drill = await cards.nth(4).locator("img").getAttribute("src");
  const trailer = await cards.nth(6).locator("img").getAttribute("src");
  await page.goto(pathToFileURL(input).href + "#/annonse/borhammer");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const element of document.querySelectorAll(
      '[id^="standalone-export"]',
    ))
      element.remove();
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });
  await page.screenshot({ path: path.join(work, "detail.png") });
  if (errors.length) throw new Error(errors.join("\n"));
  await context.close();

  await command([
    "-ss",
    "6.5",
    "-i",
    path.join(root, "public/videos/intro.mp4"),
    "-frames:v",
    "1",
    path.join(work, "gpsi.png"),
  ]);
  const data = async (filename, mime = "image/png") =>
    `data:${mime};base64,${(await readFile(filename)).toString("base64")}`;
  const assets = {
    home: await data(path.join(work, "home.png")),
    browse: await data(path.join(work, "browse.png")),
    detail: await data(path.join(work, "detail.png")),
    gpsi: await data(path.join(work, "gpsi.png")),
    font: await data(
      path.join(
        root,
        "node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
      ),
      "font/woff2",
    ),
    hero,
    drill,
    trailer,
  };
  const template = await readFile(
    path.join(root, "scripts/reel-canvas.html"),
    "utf8",
  );
  const composition = template.replace(
    "/* ASSET_DATA */ {}",
    JSON.stringify(assets),
  );
  await writeFile(path.join(work, "composition.html"), composition);
  const stage = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
  });
  await stage.goto(pathToFileURL(path.join(work, "composition.html")).href);
  await stage.evaluate(() => window.ready);
  for (const [i, time] of [0.8, 3.5, 6.1, 8.6].entries()) {
    const png = await stage.evaluate((t) => {
      window.renderFrame(t);
      return document
        .querySelector("canvas")
        .toDataURL("image/png")
        .split(",")[1];
    }, time);
    await writeFile(
      path.join(work, `scene-${i}.png`),
      Buffer.from(png, "base64"),
    );
  }
  await command([
    "-i",
    path.join(work, "scene-%d.png"),
    "-vf",
    "scale=270:480,tile=4x1",
    "-frames:v",
    "1",
    path.join(work, "storyboard.jpg"),
  ]);
  console.log("Storyboard: " + path.join(work, "storyboard.jpg"));
  if (process.argv.includes("--preview")) process.exitCode = 0;
  else {
    // Original synthesized backing track: no third-party recordings or samples.
    const rate = 48000;
    const samples = rate * 10;
    const wav = Buffer.alloc(44 + samples * 4);
    wav.write("RIFF");
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(2, 22);
    wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate * 4, 28);
    wav.writeUInt16LE(4, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(samples * 4, 40);
    const chords = [
      [146.83, 185, 220, 277.18],
      [110, 146.83, 185, 220],
      [130.81, 164.81, 196, 261.63],
      [146.83, 185, 220, 293.66],
    ];
    let noise = 123456789;
    for (let i = 0; i < samples; i++) {
      const t = i / rate;
      const beat = t % 0.5;
      const tick = t % 0.25;
      const chord = chords[Math.min(3, Math.floor(t / 2.5))];
      noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
      const random = noise / 2147483648 - 1;
      const kick =
        Math.sin(2 * Math.PI * (48 * beat + 8 * (1 - Math.exp(-beat * 36)))) *
        Math.exp(-beat * 20) *
        0.2;
      const hat = random * Math.exp(-tick * 120) * 0.023;
      const note = chord[Math.floor(t / 0.25) % 4] * 2;
      const pluck =
        (Math.sin(2 * Math.PI * note * t) +
          0.18 * Math.sin(4 * Math.PI * note * t)) *
        Math.exp(-tick * 15) *
        Math.min(1, tick / 0.008) *
        0.07;
      const pad =
        chord.reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * t), 0) *
        0.013;
      const fade = Math.min(1, t / 0.12, (10 - t) / 0.6);
      const value = Math.max(
        -1,
        Math.min(1, (kick + hat + pluck + pad) * fade),
      );
      wav.writeInt16LE(Math.round(value * 32767), 44 + i * 4);
      wav.writeInt16LE(Math.round(value * 32767), 46 + i * 4);
    }
    await writeFile(path.join(work, "soundtrack.wav"), wav);
    const encoder = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "image2pipe",
        "-framerate",
        "30",
        "-vcodec",
        "mjpeg",
        "-i",
        "pipe:0",
        "-i",
        path.join(work, "soundtrack.wav"),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "19",
        "-threads",
        "3",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=in_range=pc:out_range=tv,format=yuv420p",
        "-color_range",
        "tv",
        "-profile:v",
        "high",
        "-level:v",
        "4.1",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-af",
        "loudnorm=I=-18:TP=-1.5:LRA=7",
        "-ar",
        "48000",
        "-t",
        "10",
        "-movflags",
        "+faststart",
        path.join(output, "Laanndet-10s.mp4"),
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    const finished = once(encoder, "exit");
    for (let frame = 0; frame < 300; frame++) {
      const jpeg = await stage.evaluate((t) => {
        window.renderFrame(t);
        return document
          .querySelector("canvas")
          .toDataURL("image/jpeg", 0.94)
          .split(",")[1];
      }, frame / 30);
      if (!encoder.stdin.write(Buffer.from(jpeg, "base64")))
        await once(encoder.stdin, "drain");
      if (frame % 60 === 0) console.log(`Rendered ${frame}/300 frames`);
    }
    encoder.stdin.end();
    const [code] = await finished;
    if (code !== 0) throw new Error(`Encoder failed: ${code}`);
    await command([
      "-i",
      path.join(work, "scene-3.png"),
      "-q:v",
      "2",
      path.join(output, "Laanndet-cover.jpg"),
    ]);
    console.log("Finished: " + path.join(output, "Laanndet-10s.mp4"));
  }
} finally {
  await browser.close();
}
