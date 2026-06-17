import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { components } from "./components.mjs";

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractReleaseNotes(changelogPath, version) {
  const changelog = fs.readFileSync(changelogPath, "utf8");
  const escapedVersion = escapeRegExp(version);
  const matcher = new RegExp(`## ${escapedVersion}[\\s\\S]*?(?=\\n## |$)`);
  const match = changelog.match(matcher);

  if (!match) {
    return `Release ${version}`;
  }

  return match[0].trim();
}

export function readPackage(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

export function readPackageFromGit(repoRoot, ref, packageJsonPath) {
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

// Components whose version differs from `baseSha`, paired with the changelog
// notes for their new version. Shared by the release-PR body and the
// GitHub-release creation so both advertise the exact same release set.
// A component missing on the base (new component) counts as changed.
export function collectChangedComponents(repoRoot, baseSha) {
  const changed = [];

  for (const component of components) {
    const current = readPackage(path.join(repoRoot, component.packageJsonPath));
    const previous = readPackageFromGit(repoRoot, baseSha, component.packageJsonPath);

    if (previous && previous.version === current.version) {
      continue;
    }

    const notes = extractReleaseNotes(path.join(repoRoot, component.changelogPath), current.version);
    changed.push({ name: component.name, version: current.version, notes });
  }

  return changed;
}
