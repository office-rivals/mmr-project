import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { syncCsprojVersion } from "./version.mjs";

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

  it("handles tab-indented Version element", () => {
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
