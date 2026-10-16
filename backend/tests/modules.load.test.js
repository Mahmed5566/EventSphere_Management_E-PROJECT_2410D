import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Smoke-load every module to catch syntax errors, bad imports and typos that a
// build step would otherwise miss. These imports do not touch the database.
const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, "..");

for (const dir of ["models", "utils", "controllers", "routes"]) {
  const files = readdirSync(join(backend, dir)).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    test(`${dir}/${file} imports cleanly`, async () => {
      const mod = await import(new URL(`../${dir}/${file}`, import.meta.url));
      assert.ok(mod);
    });
  }
}
