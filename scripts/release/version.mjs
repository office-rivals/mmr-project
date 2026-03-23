import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const components = [
  {
    name: "frontend",
    packageJsonPath: path.join(repoRoot, "frontend/package.json")
  },
  {
    name: "api",
    packageJsonPath: path.join(repoRoot, "api/package.json"),
    sync(version) {
      const projectPath = path.join(repoRoot, "api/MMRProject.Api/MMRProject.Api.csproj");
      const projectFile = fs.readFileSync(projectPath, "utf8");
      const versionElement = `    <Version>${version}</Version>`;

      const updatedProjectFile = projectFile.includes("<Version>")
        ? projectFile.replace(/^[ \t]*<Version>.*<\/Version>\s*$/m, versionElement)
        : projectFile.replace(/<\/PropertyGroup>/, `${versionElement}\n  </PropertyGroup>`);

      fs.writeFileSync(projectPath, updatedProjectFile);
    }
  },
  {
    name: "mmr-api",
    packageJsonPath: path.join(repoRoot, "mmr-api/package.json")
  }
];

run(["npx", "changeset", "version"]);

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
