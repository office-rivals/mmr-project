import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./apply-changesets.mjs";
import { components } from "./components.mjs";

export function validateChangesetFile(filePath, knownComponents) {
  const content = fs.readFileSync(filePath, "utf8");
  const { bumps } = parseFrontmatter(content);
  const errors = [];
  for (const name of Object.keys(bumps)) {
    if (!knownComponents.has(name)) {
      errors.push(`Unknown component "${name}"`);
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const knownComponents = new Set(components.map((c) => c.name));
  const files = process.argv.slice(2).filter((f) => f.endsWith(".md") && path.basename(f) !== "README.md");

  if (files.length === 0) {
    console.log("No changeset files to validate.");
    process.exit(0);
  }

  let failed = false;
  for (const file of files) {
    const base = path.basename(file);
    try {
      const errors = validateChangesetFile(file, knownComponents);
      if (errors.length > 0) {
        failed = true;
        for (const err of errors) console.error(`${base}: ${err}`);
      }
    } catch (err) {
      failed = true;
      console.error(`${base}: ${err.message}`);
    }
  }

  if (failed) {
    console.error("");
    console.error(`Known components: ${[...knownComponents].join(", ")}`);
    process.exit(1);
  }

  console.log(`Validated ${files.length} changeset file(s).`);
}
