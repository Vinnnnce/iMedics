import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("workspace-preview/dist/assets", { recursive: true });
await copyFile("workspace-preview/index.html", "workspace-preview/dist/index.html");
await build({
  entryPoints: ["workspace-preview/entry.tsx"], bundle: true, minify: true, jsx: "automatic",
  outdir: "workspace-preview/dist/assets", entryNames: "preview", sourcemap: false,
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY": '""' },
  alias: { "@": `${process.cwd()}/src` },
});
