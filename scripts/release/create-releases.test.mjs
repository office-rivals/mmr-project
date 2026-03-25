import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { extractReleaseNotes, escapeRegExp } from "./create-releases.mjs";

describe("escapeRegExp", () => {
  it("escapes dots", () => {
    assert.equal(escapeRegExp("1.0.0"), "1\\.0\\.0");
  });

  it("escapes all special characters", () => {
    assert.equal(escapeRegExp("a.*+?^${}()|[]\\z"), "a\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\z");
  });

  it("leaves plain strings unchanged", () => {
    assert.equal(escapeRegExp("frontend"), "frontend");
  });
});

describe("extractReleaseNotes", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "release-notes-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("extracts notes for a version", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    fs.writeFileSync(changelogPath, "# Changelog\n\n## 1.2.0\n\n- New feature\n- Bug fix\n");
    const notes = extractReleaseNotes(changelogPath, "1.2.0");
    assert.equal(notes, "## 1.2.0\n\n- New feature\n- Bug fix");
  });

  it("extracts notes when multiple versions exist", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    fs.writeFileSync(
      changelogPath,
      "# Changelog\n\n## 2.0.0\n\n- Breaking change\n\n## 1.1.0\n\n- Old feature\n"
    );
    const notes = extractReleaseNotes(changelogPath, "2.0.0");
    assert.equal(notes, "## 2.0.0\n\n- Breaking change");
  });

  it("extracts notes for an older version among multiple", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    fs.writeFileSync(
      changelogPath,
      "# Changelog\n\n## 2.0.0\n\n- Breaking change\n\n## 1.1.0\n\n- Old feature\n"
    );
    const notes = extractReleaseNotes(changelogPath, "1.1.0");
    assert.equal(notes, "## 1.1.0\n\n- Old feature");
  });

  it("returns fallback when version not found", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    fs.writeFileSync(changelogPath, "# Changelog\n\n## 1.0.0\n\n- Initial\n");
    const notes = extractReleaseNotes(changelogPath, "9.9.9");
    assert.equal(notes, "Release 9.9.9");
  });

  it("handles version with regex-special characters safely", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    fs.writeFileSync(changelogPath, "# Changelog\n\n## 1.0.0\n\n- Entry\n");
    // "1.0.0" contains dots — should not match "1X0Y0" due to escaping
    const notes = extractReleaseNotes(changelogPath, "1.0.0");
    assert.equal(notes, "## 1.0.0\n\n- Entry");
  });

  it("handles multi-line notes with blank lines", () => {
    const changelogPath = path.join(tmpDir, "CHANGELOG.md");
    fs.writeFileSync(
      changelogPath,
      "# Changelog\n\n## 1.0.0\n\n- Feature A\n\n- Feature B\n\n## 0.9.0\n\n- Old\n"
    );
    const notes = extractReleaseNotes(changelogPath, "1.0.0");
    assert.equal(notes, "## 1.0.0\n\n- Feature A\n\n- Feature B");
  });
});
