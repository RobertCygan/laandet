import { existsSync } from "node:fs";
import chromium from "@sparticuz/chromium";
export async function resolveBrowser() {
  const installed =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    [
      "/workspace/.cache/google-chrome/opt/google/chrome/chrome",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ].find(existsSync);
  return {
    executablePath: installed || (await chromium.executablePath()),
    bundled: !installed,
    args: installed
      ? ["--no-sandbox", "--disable-dev-shm-usage"]
      : chromium.args.filter((arg) => arg !== "--single-process"),
  };
}
