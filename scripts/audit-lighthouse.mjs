import lighthouse from "lighthouse";
import { resolveBrowser } from "./browser.mjs";
import { chromium as browserType } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
// The server must already be running. Chrome's debugging port is local only.
const { executablePath, args } = await resolveBrowser();
const browser = await browserType.launch({
  executablePath,
  args: [...args, "--remote-debugging-port=9222"],
  env: { ...process.env, XDG_CACHE_HOME: "/tmp/laanndet-browser-cache" },
});
try {
  await mkdir("reports", { recursive: true });
  for (const device of ["mobile", "desktop"]) {
    const result = await lighthouse("http://127.0.0.1:3000/", {
      port: 9222,
      logLevel: "error",
      output: ["json", "html"],
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      ...(device === "desktop"
        ? {
            formFactor: "desktop",
            screenEmulation: {
              mobile: false,
              width: 1440,
              height: 1000,
              deviceScaleFactor: 1,
              disabled: false,
            },
            throttling: {
              rttMs: 40,
              throughputKbps: 10240,
              cpuSlowdownMultiplier: 1,
            },
          }
        : {}),
    });
    if (!result || result.lhr.runtimeError)
      throw new Error(
        result?.lhr.runtimeError?.message || "No Lighthouse result",
      );
    await writeFile(`reports/lighthouse-${device}.json`, result.report[0]);
    await writeFile(`reports/lighthouse-${device}.html`, result.report[1]);
    console.log(
      JSON.stringify(
        {
          device,
          scores: Object.fromEntries(
            Object.entries(result.lhr.categories).map(([key, value]) => [
              key,
              Math.round(value.score * 100),
            ]),
          ),
          metrics: {
            LCP: result.lhr.audits["largest-contentful-paint"].displayValue,
            CLS: result.lhr.audits["cumulative-layout-shift"].displayValue,
            TBT: result.lhr.audits["total-blocking-time"].displayValue,
          },
        },
        null,
        2,
      ),
    );
  }
} finally {
  await browser.close();
}
