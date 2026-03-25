import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseFrontmatter, incrementVersion, updateChangelog } from "./apply-changesets.mjs";

describe("parseFrontmatter", () => {
  it("parses quoted keys", () => {
    const content = '---\n"frontend": minor\n---\n\nSome change.';
    const result = parseFrontmatter(content);
    assert.deepEqual(result.bumps, { frontend: "minor" });
    assert.equal(result.description, "Some change.");
  });

  it("parses unquoted keys", () => {
    const content = "---\nfrontend: minor\n---\n\nSome change.";
    const result = parseFrontmatter(content);
    assert.deepEqual(result.bumps, { frontend: "minor" });
    assert.equal(result.description, "Some change.");
  });

  it("parses multiple components", () => {
    const content = '---\n"frontend": minor\n"api": patch\n---\n\nMulti bump.';
    const result = parseFrontmatter(content);
    assert.deepEqual(result.bumps, { frontend: "minor", api: "patch" });
    assert.equal(result.description, "Multi bump.");
  });

  it("parses hyphenated component names", () => {
    const content = "---\nmmr-api: major\n---\n";
    const result = parseFrontmatter(content);
    assert.deepEqual(result.bumps, { "mmr-api": "major" });
  });

  it("handles CRLF line endings", () => {
    const content = '---\r\n"frontend": minor\r\n---\r\n\r\nDescription.';
    const result = parseFrontmatter(content);
    assert.deepEqual(result.bumps, { frontend: "minor" });
    assert.equal(result.description, "Description.");
  });

  it("handles empty description", () => {
    const content = "---\nfrontend: patch\n---\n";
    const result = parseFrontmatter(content);
    assert.deepEqual(result.bumps, { frontend: "patch" });
    assert.equal(result.description, "");
  });

  it("handles multi-line description", () => {
    const content = "---\nfrontend: minor\n---\n\nFirst line.\n\nSecond paragraph.";
    const result = parseFrontmatter(content);
    assert.equal(result.description, "First line.\n\nSecond paragraph.");
  });

  it("throws on missing frontmatter", () => {
    assert.throws(() => parseFrontmatter("no frontmatter here"), /missing frontmatter/);
  });

  it("throws on empty frontmatter", () => {
    assert.throws(() => parseFrontmatter("---\n\n---\n"), /no component bumps found/);
  });

  it("throws on invalid bump type", () => {
    assert.throws(() => parseFrontmatter("---\nfrontend: huge\n---\n"), /Invalid changeset frontmatter line/);
  });

  it("throws on malformed frontmatter line", () => {
    assert.throws(() => parseFrontmatter("---\nnot valid yaml\n---\n"), /Invalid changeset frontmatter line/);
  });

  it("ignores blank lines in frontmatter", () => {
    const content = '---\n"frontend": minor\n\n"api": patch\n---\n';
    const result = parseFrontmatter(content);
    assert.deepEqual(result.bumps, { frontend: "minor", api: "patch" });
  });
});

describe("incrementVersion", () => {
  it("bumps major", () => {
    assert.equal(incrementVersion("1.2.3", "major"), "2.0.0");
  });

  it("bumps minor", () => {
    assert.equal(incrementVersion("1.2.3", "minor"), "1.3.0");
  });

  it("bumps patch", () => {
    assert.equal(incrementVersion("1.2.3", "patch"), "1.2.4");
  });

  it("bumps from zero", () => {
    assert.equal(incrementVersion("0.0.0", "patch"), "0.0.1");
    assert.equal(incrementVersion("0.0.0", "minor"), "0.1.0");
    assert.equal(incrementVersion("0.0.0", "major"), "1.0.0");
  });

  it("throws on invalid version format", () => {
    assert.throws(() => incrementVersion("1.0", "patch"), /Invalid semver version/);
    assert.throws(() => incrementVersion("1.0.0-beta", "patch"), /Invalid semver version/);
    assert.throws(() => incrementVersion("not.a.version", "patch"), /Invalid semver version/);
  });

  it("throws on invalid bump type", () => {
    assert.throws(() => incrementVersion("1.0.0", "huge"), /Invalid bump type/);
  });
});

describe("updateChangelog", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("creates new changelog when file does not exist", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    updateChangelog(changelogPath, "1.0.0", ["Initial release"]);
    const content = fs.readFileSync(changelogPath, "utf8");
    assert.match(content, /^# Changelog\n\n## 1\.0\.0\n\n- Initial release\n/);
  });

  it("prepends to existing changelog after header", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    fs.writeFileSync(changelogPath, "# Changelog\n\n## 0.1.0\n\n- Old entry\n");
    updateChangelog(changelogPath, "0.2.0", ["New feature"]);
    const content = fs.readFileSync(changelogPath, "utf8");
    assert.match(content, /^# Changelog\n\n## 0\.2\.0\n\n- New feature\n/);
    assert.match(content, /## 0\.1\.0\n\n- Old entry/);
  });

  it("handles version with no descriptions", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    updateChangelog(changelogPath, "1.0.0", []);
    const content = fs.readFileSync(changelogPath, "utf8");
    assert.match(content, /## 1\.0\.0\n/);
    assert.doesNotMatch(content, /^- /m);
  });

  it("handles multi-line descriptions", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    updateChangelog(changelogPath, "1.0.0", ["First line\nSecond line\nThird line"]);
    const content = fs.readFileSync(changelogPath, "utf8");
    assert.match(content, /- First line\n {2}Second line\n {2}Third line/);
  });

  it("handles multiple descriptions", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    updateChangelog(changelogPath, "1.0.0", ["Change one", "Change two"]);
    const content = fs.readFileSync(changelogPath, "utf8");
    assert.match(content, /- Change one\n- Change two/);
  });

  it("prepends to changelog without header", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    fs.writeFileSync(changelogPath, "## 0.1.0\n\n- Old entry\n");
    updateChangelog(changelogPath, "0.2.0", ["New feature"]);
    const content = fs.readFileSync(changelogPath, "utf8");
    assert.match(content, /^## 0\.2\.0\n\n- New feature\n/);
    assert.match(content, /## 0\.1\.0\n\n- Old entry/);
  });
});
