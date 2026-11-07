/** Build an isolated browser QA harness using the real production components. */
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
const root = process.cwd();
const out = `${root}/qa/feature-audit/dist`;
await mkdir(out, { recursive: true });
await copyFile("qa/feature-audit/index.html", `${out}/index.html`);
await build({
  entryPoints: ["qa/feature-audit/entry.tsx"], bundle: true, minify: false, jsx: "automatic",
  outfile: `${out}/audit.js`,
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": `${root}/src`, "next/link": `${root}/qa/feature-audit/link.tsx`, "next/navigation": `${root}/qa/feature-audit/navigation.ts` },
});
const css = await postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), { from: `${root}/src/app/globals.css` });
await writeFile(`${out}/audit.css`, css.css);
console.log("Built isolated feature QA harness:", out);
