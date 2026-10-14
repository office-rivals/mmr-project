import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { alignedMajorVersions, syncCsprojVersion, syncPackageLockVersion } from "./version.mjs";

it("allows an independent beta major while retaining stable-component alignment", () => {
  const versions = [
    { name: "frontend", version: "1.6.0" },
    { name: "api", version: "1.5.0" },
    { name: "frontend-beta", version: "0.1.0", independentMajor: true }
  ];
  assert.equal(alignedMajorVersions(versions).size, 1);
  assert.equal(alignedMajorVersions([...versions, { name: "mmr-api", version: "2.0.0" }]).size, 2);
});

it("updates release metadata in the component lockfile without changing dependency versions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-lock-test-"));
  try {
    const lockPath = path.join(dir, "package-lock.json");
    fs.writeFileSync(lockPath, JSON.stringify({ version: "0.0.0", packages: {
      "": { name: "frontend-beta", version: "0.0.0" },
      "node_modules/react": { version: "19.3.0" }
    } }));
    syncPackageLockVersion(path.join(dir, "package.json"), "0.1.0");
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    assert.equal(lock.version, "0.1.0");
    assert.equal(lock.packages[""].version, "0.1.0");
    assert.equal(lock.packages["node_modules/react"].version, "19.3.0");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("syncCsprojVersion", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "csproj-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("replaces existing Version element", () => {
    const csproj = path.join(tmpDir, "Test.csproj");
    fs.writeFileSync(
      csproj,
      `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Version>0.0.1</Version>
  </PropertyGroup>
</Project>
`
    );
    syncCsprojVersion(csproj, "1.2.0");
    const result = fs.readFileSync(csproj, "utf8");
    assert.match(result, /<Version>1\.2\.0<\/Version>/);
    assert.doesNotMatch(result, /0\.0\.1/);
  });

  it("inserts Version when not present", () => {
    const csproj = path.join(tmpDir, "Test.csproj");
    fs.writeFileSync(
      csproj,
      `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
`
    );
    syncCsprojVersion(csproj, "2.0.0");
    const result = fs.readFileSync(csproj, "utf8");
    assert.match(result, /<Version>2\.0\.0<\/Version>/);
    assert.match(result, /<Version>2\.0\.0<\/Version>\n {2}<\/PropertyGroup>/);
  });

  it("preserves other elements when replacing", () => {
    const csproj = path.join(tmpDir, "Test.csproj");
    fs.writeFileSync(
      csproj,
      `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Version>1.0.0</Version>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
`
    );
    syncCsprojVersion(csproj, "1.1.0");
    const result = fs.readFileSync(csproj, "utf8");
    assert.match(result, /<TargetFramework>net8\.0<\/TargetFramework>/);
    assert.match(result, /<Version>1\.1\.0<\/Version>/);
    assert.match(result, /<Nullable>enable<\/Nullable>/);
  });

  it("replaces Version regardless of original indentation style", () => {
    const csproj = path.join(tmpDir, "Test.csproj");
    fs.writeFileSync(
      csproj,
      `<Project Sdk="Microsoft.NET.Sdk.Web">\n\t<PropertyGroup>\n\t\t<Version>0.1.0</Version>\n\t</PropertyGroup>\n</Project>\n`
    );
    syncCsprojVersion(csproj, "0.2.0");
    const result = fs.readFileSync(csproj, "utf8");
    assert.match(result, /<Version>0\.2\.0<\/Version>/);
    assert.doesNotMatch(result, /0\.1\.0/);
  });
});
