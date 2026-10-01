import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const output = join(root, "dist");
if (dirname(output) !== root) throw new Error("Build output must be inside the package.");
rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"], {
  cwd: root,
  stdio: "inherit",
});
mkdirSync(new URL("../dist/components/", import.meta.url), { recursive: true });
cpSync(new URL("../src/components/", import.meta.url), new URL("../dist/components/", import.meta.url), {
  recursive: true,
});
for (const entry of ["index.js", "index.d.ts"]) {
  cpSync(join(root, "src", entry), join(output, entry));
}
