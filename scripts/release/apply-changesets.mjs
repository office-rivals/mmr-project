import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { components } from "./components.mjs";

export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error("Invalid changeset: missing frontmatter");
  }

  const bumps = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^"?([^"]+?)"?:\s*(major|minor|patch)\s*$/);
    if (!m) {
      throw new Error(`Invalid changeset frontmatter line: ${line}`);
    }
    bumps[m[1]] = m[2];
  }

  if (Object.keys(bumps).length === 0) {
    throw new Error("Invalid changeset: no component bumps found");
  }

  const description = content.slice(match[0].length).trim();
  return { bumps, description };
}

export function incrementVersion(version, bumpType) {
  const parts = version.split(".");
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
    throw new Error(`Invalid semver version: ${version}`);
  }
  const [major, minor, patch] = parts.map(Number);
  switch (bumpType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
}

export function updateChangelog(changelogPath, version, descriptions) {
  const formatDescription = (description) => {
    const [firstLine, ...rest] = description.split(/\r?\n/);
    return [`- ${firstLine}`, ...rest.map((line) => `  ${line}`)].join("\n");
  };
  const entry =
    descriptions.length > 0
      ? `## ${version}\n\n${descriptions.map(formatDescription).join("\n")}\n`
      : `## ${version}\n`;

  if (fs.existsSync(changelogPath)) {
    const existing = fs.readFileSync(changelogPath, "utf8");
    const headerMatch = existing.match(/^# .+\n+/);

    if (headerMatch) {
      const after = existing.slice(headerMatch[0].length);
      fs.writeFileSync(changelogPath, `${headerMatch[0]}${entry}\n${after}`);
    } else {
      fs.writeFileSync(changelogPath, `${entry}\n${existing}`);
    }
  } else {
    fs.writeFileSync(changelogPath, `# Changelog\n\n${entry}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const changesetDir = path.join(repoRoot, ".changeset");
  const componentMap = Object.create(null);
  for (const c of components) componentMap[c.name] = c;

  const changesetFiles = fs
    .readdirSync(changesetDir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()
    .map((f) => path.join(changesetDir, f));

  if (changesetFiles.length === 0) {
    console.log("No pending changesets found.");
    process.exit(0);
  }

  const bumpPriority = { major: 3, minor: 2, patch: 1 };
  const aggregated = Object.create(null);

  for (const file of changesetFiles) {
    let bumps, description;
    try {
      ({ bumps, description } = parseFrontmatter(fs.readFileSync(file, "utf8")));
    } catch (err) {
      throw new Error(`${err.message} in ${path.basename(file)}`);
    }

    for (const [name, bumpType] of Object.entries(bumps)) {
      if (!(name in componentMap)) {
        console.error(`Unknown component "${name}" in ${path.basename(file)}`);
        process.exit(1);
      }

      if (!(name in aggregated)) {
        aggregated[name] = { bumpType, descriptions: [] };
      }

      if (bumpPriority[bumpType] > bumpPriority[aggregated[name].bumpType]) {
        aggregated[name].bumpType = bumpType;
      }

      if (description) {
        aggregated[name].descriptions.push(description);
      }
    }
  }

  const plannedUpdates = [];
  for (const [name, { bumpType, descriptions }] of Object.entries(aggregated)) {
    const pkgPath = path.join(repoRoot, componentMap[name].packageJsonPath);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const oldVersion = pkg.version;
    const newVersion = incrementVersion(oldVersion, bumpType);
    plannedUpdates.push({ name, bumpType, descriptions, pkgPath, pkg, oldVersion, newVersion });
  }

  for (const u of plannedUpdates) {
    u.pkg.version = u.newVersion;
    fs.writeFileSync(u.pkgPath, JSON.stringify(u.pkg, null, 2) + "\n");
    updateChangelog(path.join(repoRoot, componentMap[u.name].changelogPath), u.newVersion, u.descriptions);
    console.log(`${u.name}: ${u.oldVersion} → ${u.newVersion} (${u.bumpType})`);
  }

  for (const file of changesetFiles) {
    fs.unlinkSync(file);
  }
}
