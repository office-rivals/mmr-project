export const components = [
  { name: "frontend", packageJsonPath: "frontend/package.json", changelogPath: "frontend/CHANGELOG.md", imageContext: "./frontend" },
  { name: "frontend-beta", packageJsonPath: "frontend-beta/package.json", changelogPath: "frontend-beta/CHANGELOG.md", imageContext: "./frontend-beta", independentMajor: true },
  { name: "api", packageJsonPath: "api/package.json", changelogPath: "api/CHANGELOG.md", imageContext: "./api/MMRProject.Api" },
  { name: "mmr-api", packageJsonPath: "mmr-api/package.json", changelogPath: "mmr-api/CHANGELOG.md", imageContext: "./mmr-api", versionBuildArg: true }
];
