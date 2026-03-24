import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [baseSha, headSha] = process.argv.slice(2);

if (!baseSha || !headSha) {
  console.error("Usage: node ./scripts/release/create-releases.mjs <base-sha> <head-sha>");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const components = [
  { name: "frontend", packageJsonPath: "frontend/package.json", changelogPath: "frontend/CHANGELOG.md" },
  { name: "api", packageJsonPath: "api/package.json", changelogPath: "api/CHANGELOG.md" },
  { name: "mmr-api", packageJsonPath: "mmr-api/package.json", changelogPath: "mmr-api/CHANGELOG.md" }
];

for (const component of components) {
  const currentPackage = readPackage(path.join(repoRoot, component.packageJsonPath));
  const previousPackage = readPackageFromGit(baseSha, component.packageJsonPath);

  if (previousPackage && previousPackage.version === currentPackage.version) {
    continue;
  }

  const tag = `${component.name}@${currentPackage.version}`;
  if (releaseExists(tag)) {
    continue;
  }

  const notes = extractReleaseNotes(path.join(repoRoot, component.changelogPath), currentPackage.version);
  const notesFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "release-notes-")), `${component.name}.md`);
  fs.writeFileSync(notesFile, notes);

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
      `${component.name} v${currentPackage.version}`,
      "--notes-file",
      notesFile
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env
    }
  );
}

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

function extractReleaseNotes(changelogPath, version) {
  const changelog = fs.readFileSync(changelogPath, "utf8");
  const escapedVersion = escapeRegExp(version);
  const matcher = new RegExp(`## ${escapedVersion}[\\s\\S]*?(?=\\n## |$)`);
  const match = changelog.match(matcher);

  if (!match) {
    return `Release ${version}`;
  }

  return match[0].trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
