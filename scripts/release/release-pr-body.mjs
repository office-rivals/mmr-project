import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectChangedComponents } from "./releases.mjs";

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
  const releases = collectChangedComponents(repoRoot, baseSha);

  process.stdout.write(renderReleasePrBody(releases) + "\n");
}
