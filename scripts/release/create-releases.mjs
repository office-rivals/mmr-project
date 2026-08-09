import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectChangedComponents } from "./releases.mjs";
import { components } from "./components.mjs";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [baseSha, headSha] = process.argv.slice(2);

  if (!baseSha || !headSha) {
    console.error("Usage: node ./scripts/release/create-releases.mjs <base-sha> <head-sha>");
    process.exit(1);
  }

  if (!process.env.GITHUB_REPOSITORY) {
    console.error("Error: GITHUB_REPOSITORY environment variable is required");
    process.exit(1);
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  // Components whose version changed in this release. Collected independently of
  // whether the GitHub release already exists, so a workflow re-run still reports
  // them to downstream steps (e.g. image builds) after a transient failure.
  const changed = collectChangedComponents(repoRoot, baseSha);

  // The image build takes its whole plan from here, so the version it tags and
  // the version released below are one value rather than two reads that could
  // drift. Built before the first release is cut: a component missing its image
  // metadata then fails while nothing has been published yet.
  const released = changed.map(({ name, version }) => {
    const component = components.find((candidate) => candidate.name === name);

    if (!component?.imageContext) {
      console.error(`Component ${name} is missing imageContext in components.mjs`);
      process.exit(1);
    }

    return {
      name,
      version,
      context: component.imageContext,
      buildArgs: component.versionBuildArg ? `VERSION=${version}` : ""
    };
  });

  for (const { name, version, notes } of changed) {
    const tag = `${name}@${version}`;
    if (releaseExists(tag)) {
      continue;
    }

    const notesDir = fs.mkdtempSync(path.join(os.tmpdir(), "release-notes-"));
    const notesFile = path.join(notesDir, `${name}.md`);
    fs.writeFileSync(notesFile, notes);

    try {
      execFileSync(
        "gh",
        [
          "release",
          "create",
          tag,
          "--repo",
          process.env.GITHUB_REPOSITORY,
          "--target",
          headSha,
          "--title",
          `${name} v${version}`,
          "--notes-file",
          notesFile
        ],
        {
          cwd: repoRoot,
          stdio: "inherit",
          env: process.env
        }
      );
    } finally {
      fs.rmSync(notesDir, { recursive: true });
    }
  }

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `released=${JSON.stringify(released)}\n`);
  }

  function releaseExists(tag) {
    try {
      execFileSync(
        "gh",
        ["release", "view", tag, "--repo", process.env.GITHUB_REPOSITORY],
        {
          cwd: repoRoot,
          stdio: "ignore",
          env: process.env
        }
      );
      return true;
    } catch {
      return false;
    }
  }
}
