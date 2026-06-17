import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { components } from "./components.mjs";
import { extractReleaseNotes } from "./create-releases.mjs";

const PREAMBLE =
  "This PR was automatically generated to apply pending changesets.\n\n" +
  "Merging it publishes a GitHub Release for each component below and triggers its image build. " +
  "Do not edit versions manually — the release workflow owns them.";

// `releases` is `[{ name, version, notes }]` where `notes` is the changelog
// section for the new version (as returned by extractReleaseNotes), so the PR
// body shows exactly what each component's GitHub Release will contain.
export function renderReleasePrBody(releases) {
  if (releases.length === 0) {
    return `${PREAMBLE}\n\n_No component version changes detected._`;
  }

  const sections = releases.map(({ name, version, notes }) => {
    const lines = notes.split(/\r?\n/);
    const body = (lines[0].startsWith("## ") ? lines.slice(1) : lines).join("\n").trim();
    const heading = `### ${name}@${version}`;
    return body ? `${heading}\n\n${body}` : heading;
  });

  return `${PREAMBLE}\n\n## Releases\n\n${sections.join("\n\n")}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseSha = process.argv[2];

  if (!baseSha) {
    console.error("Usage: node ./scripts/release/release-pr-body.mjs <base-sha>");
    process.exit(1);
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const releases = [];

  for (const component of components) {
    const current = readPackage(path.join(repoRoot, component.packageJsonPath));
    const previous = readPackageFromGit(baseSha, component.packageJsonPath);

    // A missing base package (new component) counts as changed.
    if (previous && previous.version === current.version) {
      continue;
    }

    const notes = extractReleaseNotes(path.join(repoRoot, component.changelogPath), current.version);
    releases.push({ name: component.name, version: current.version, notes });
  }

  process.stdout.write(renderReleasePrBody(releases) + "\n");

  function readPackage(packageJsonPath) {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  }

  function readPackageFromGit(ref, packageJsonPath) {
    try {
      const file = execFileSync("git", ["show", `${ref}:${packageJsonPath}`], {
        cwd: repoRoot,
        encoding: "utf8"
      });
      return JSON.parse(file);
    } catch {
      return null;
    }
  }
}
