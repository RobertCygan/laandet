import { resolveBrowser } from "./browser.mjs";
import { spawn } from "node:child_process";
// Prefer the verified full browser prepared in the cloud cache. A packaged
// Chromium remains available as a fallback without a browser-CDN download.
const { executablePath, bundled } = await resolveBrowser();
const child = spawn(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      XDG_CACHE_HOME: "/tmp/laanndet-browser-cache",
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: executablePath,
      LAANNDET_BUNDLED_BROWSER: bundled ? "1" : "0",
    },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
