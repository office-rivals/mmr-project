import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectChangedComponents } from "./releases.mjs";
import { components } from "./components.mjs";

// One entry per released component that ships a container image. A component
// without `imageContext` is not containerized and is simply absent here — its
// GitHub release is unaffected.
export function buildImagePlan(changed, repository) {
  const repo = repository.toLowerCase();

  return changed.flatMap(({ name, version }) => {
    const component = components.find((candidate) => candidate.name === name);

    if (!component?.imageContext) {
      return [];
    }

    return [
      {
        name,
        version,
        context: component.imageContext,
        image: `ghcr.io/${repo}/${name}`,
        buildArgs: component.versionBuildArg ? `VERSION=${version}` : ""
      }
    ];
  });
}

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

  // Built from the same versions the releases below are cut from, so the image
  // tag and the release cannot drift apart.
  const released = buildImagePlan(changed, process.env.GITHUB_REPOSITORY);

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
