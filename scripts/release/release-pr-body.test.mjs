import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderReleasePrBody } from "./release-pr-body.mjs";

describe("renderReleasePrBody", () => {
  it("reports when no components changed", () => {
    const body = renderReleasePrBody([]);
    assert.match(body, /No component version changes detected/);
  });

  it("renders a component-scoped heading and its notes", () => {
    const body = renderReleasePrBody([
      { name: "frontend", version: "1.2.0", notes: "## 1.2.0\n\n- New feature\n- Bug fix" }
    ]);
    assert.match(body, /### frontend@1\.2\.0/);
    assert.match(body, /- New feature\n- Bug fix/);
    // The raw "## version" heading from the changelog is replaced, not duplicated.
    assert.doesNotMatch(body, /^## 1\.2\.0/m);
  });

  it("renders multiple components in order", () => {
    const body = renderReleasePrBody([
      { name: "api", version: "2.1.0", notes: "## 2.1.0\n\n- API change" },
      { name: "mmr-api", version: "0.3.1", notes: "## 0.3.1\n\n- MMR change" }
    ]);
    assert.ok(body.indexOf("### api@2.1.0") < body.indexOf("### mmr-api@0.3.1"));
    assert.match(body, /- API change/);
    assert.match(body, /- MMR change/);
  });

  it("renders only a heading when there are no notes", () => {
    const body = renderReleasePrBody([{ name: "api", version: "2.1.0", notes: "## 2.1.0" }]);
    assert.match(body, /### api@2\.1\.0/);
    assert.doesNotMatch(body, /^- /m);
  });

  it("keeps fallback notes that lack a version heading", () => {
    const body = renderReleasePrBody([{ name: "api", version: "2.1.0", notes: "Release 2.1.0" }]);
    assert.match(body, /### api@2\.1\.0\n\nRelease 2\.1\.0/);
  });

  it("handles CRLF line endings in notes", () => {
    const body = renderReleasePrBody([
      { name: "frontend", version: "1.0.0", notes: "## 1.0.0\r\n\r\n- Windows entry" }
    ]);
    assert.match(body, /### frontend@1\.0\.0/);
    assert.match(body, /- Windows entry/);
  });
});
