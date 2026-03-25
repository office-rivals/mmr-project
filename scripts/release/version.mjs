import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { components as baseComponents } from "./components.mjs";

export function syncCsprojVersion(projectPath, version) {
  const projectFile = fs.readFileSync(projectPath, "utf8");
  const versionElement = `    <Version>${version}</Version>`;

  const updatedProjectFile = projectFile.includes("<Version>")
    ? projectFile.replace(/^[ \t]*<Version>.*<\/Version>\s*$/m, versionElement)
    : projectFile.replace(/<\/PropertyGroup>/, `${versionElement}\n  </PropertyGroup>`);

  fs.writeFileSync(projectPath, updatedProjectFile);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  const syncHandlers = {
    api(version) {
      syncCsprojVersion(path.join(repoRoot, "api/MMRProject.Api/MMRProject.Api.csproj"), version);
    }
  };

  const components = baseComponents.map((c) => ({
    ...c,
    packageJsonPath: path.join(repoRoot, c.packageJsonPath),
    sync: syncHandlers[c.name]
  }));

  run(["node", path.join(repoRoot, "scripts/release/apply-changesets.mjs")]);

  const versions = components.map((component) => {
    const packageJson = JSON.parse(fs.readFileSync(component.packageJsonPath, "utf8"));
    component.sync?.(packageJson.version);
    return { name: component.name, version: packageJson.version };
  });

  const majors = new Set(versions.map(({ version }) => version.split(".")[0]));

  if (majors.size !== 1) {
    console.error("Release versions must share the same major:");
    for (const { name, version } of versions) {
      console.error(`- ${name}: ${version}`);
    }
    process.exit(1);
  }

  run(["npm", "install", "--package-lock-only", "--ignore-scripts"]);

  function run(command) {
    const result = spawnSync(command[0], command.slice(1), {
      cwd: repoRoot,
      stdio: "inherit"
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}
