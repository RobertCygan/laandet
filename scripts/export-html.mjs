/** Build one portable HTML from the existing UI, with zero external requests. */
import { build } from "esbuild";
import { downloadControlsMarkup } from "./standalone-download-ui.mjs";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flag = process.argv.indexOf("--output");
const output =
  flag >= 0
    ? path.resolve(process.argv[flag + 1])
    : path.join(root, "out", "Laanndet.html");
const images = {};
for (const name of await readdir(path.join(root, "public/images"))) {
  if (!name.endsWith(".webp") || name === "equipment.webp") continue;
  images["/images/" + name] =
    "data:image/webp;base64," +
    (await readFile(path.join(root, "public/images", name))).toString("base64");
}
for (const [name, mime] of [
  ["intro.webm", "video/webm"],
  ["intro.mp4", "video/mp4"],
])
  images["/videos/" + name] =
    "data:" +
    mime +
    ";base64," +
    (await readFile(path.join(root, "public/videos", name))).toString("base64");
const adapter = path.join(root, "standalone/adapters.tsx");
const result = await build({
  absWorkingDir: root,
  entryPoints: ["standalone/entry.tsx"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "inline",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "portable-html",
      setup(b) {
        b.onResolve({ filter: /^standalone:assets$/ }, () => ({
          path: "assets",
          namespace: "embedded",
        }));
        b.onLoad({ filter: /.*/, namespace: "embedded" }, () => ({
          contents: "export default " + JSON.stringify(images),
          loader: "js",
        }));
        b.onResolve(
          { filter: /^next\/(link|image|navigation|dynamic)$/ },
          (args) => ({ path: args.path, namespace: "offline-next" }),
        );
        b.onLoad({ filter: /.*/, namespace: "offline-next" }, (args) => {
          const exports = {
            "next/link": "OfflineLink as default",
            "next/image": "OfflineImage as default",
            "next/navigation": "usePathname,useRouter,notFound",
            "next/dynamic": "offlineDynamic as default",
          };
          return {
            contents: `export {${exports[args.path]}} from ${JSON.stringify(adapter)};`,
            loader: "js",
            resolveDir: root,
          };
        });
      },
    },
  ],
});
const font = (
  await readFile(
    path.join(
      root,
      "node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
    ),
  )
).toString("base64");
let css = await readFile(path.join(root, "app/globals.css"), "utf8");
css = css
  .replace(/@import\s+[^;]+;/g, "")
  .replace(/@theme\s+inline\s*\{[^}]*\}/g, "");
css =
  `@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:200 800;font-style:normal;font-display:swap}:root{--font-manrope:Manrope}` +
  css;
const icon = (await readFile(path.join(root, "app/icon.svg"))).toString(
  "base64",
);
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const licenses = await Promise.all(
  ["react", "react-dom", "lucide-react", "@fontsource-variable/manrope"].map(
    async (name) =>
      name +
      "\n" +
      (await readFile(
        path.join(root, "node_modules", name, "LICENSE"),
        "utf8",
      )),
  ),
);
const html = `<!doctype html><html lang="nb"><!-- Bundled open-source licenses:\n${licenses.join("\n\n").replace(/-->/g, "-- >")}\n--><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#174d3c"><meta name="description" content="Lånndet – en selvstendig lokal research-demo. Alle annonser er eksempler."><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>Lånndet – lei ting av folk i nærheten</title><link rel="icon" href="data:image/svg+xml;base64,${icon}"><style>${css}</style></head><body><noscript><p>Åpne denne HTML-filen i en nettleser med JavaScript aktivert. Ingen installasjon eller internettilkobling er nødvendig.</p></noscript><div id="root"></div><script>${js}</script>${downloadControlsMarkup()}</body></html>`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(
  `Portable HTML: ${output}\nSize: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB; images, intro videos, font, styles, React and all demo routes embedded.`,
);
