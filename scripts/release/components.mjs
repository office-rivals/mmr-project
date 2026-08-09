export const components = [
  { name: "frontend", packageJsonPath: "frontend/package.json", changelogPath: "frontend/CHANGELOG.md", imageContext: "./frontend" },
  { name: "api", packageJsonPath: "api/package.json", changelogPath: "api/CHANGELOG.md", imageContext: "./api/MMRProject.Api" },
  { name: "mmr-api", packageJsonPath: "mmr-api/package.json", changelogPath: "mmr-api/CHANGELOG.md", imageContext: "./mmr-api", versionBuildArg: true }
];
