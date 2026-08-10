import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildImagePlan } from "./create-releases.mjs";
import { components } from "./components.mjs";

describe("buildImagePlan", () => {
  it("carries the released version straight into the image tag", () => {
    const plan = buildImagePlan([{ name: "frontend", version: "1.6.0" }], "office-rivals/mmr-project");

    assert.deepEqual(plan, [
      {
        name: "frontend",
        version: "1.6.0",
        context: "./frontend",
        image: "ghcr.io/office-rivals/mmr-project/frontend",
        buildArgs: ""
      }
    ]);
  });

  it("passes VERSION only to the component that consumes it", () => {
    const plan = buildImagePlan(
      [
        { name: "frontend", version: "1.6.0" },
        { name: "api", version: "1.5.0" },
        { name: "mmr-api", version: "1.2.4" }
      ],
      "office-rivals/mmr-project"
    );

    assert.deepEqual(
      plan.map(({ name, buildArgs }) => [name, buildArgs]),
      [
        ["frontend", ""],
        ["api", ""],
        ["mmr-api", "VERSION=1.2.4"]
      ]
    );
  });

  it("lowercases the repository, since ghcr rejects uppercase paths", () => {
    const [entry] = buildImagePlan([{ name: "api", version: "1.5.0" }], "Office-Rivals/MMR-Project");

    assert.equal(entry.image, "ghcr.io/office-rivals/mmr-project/api");
  });

  it("omits a component that ships no image without disturbing the others", () => {
    const plan = buildImagePlan(
      [
        { name: "docs", version: "1.0.0" },
        { name: "api", version: "1.5.0" }
      ],
      "office-rivals/mmr-project"
    );

    assert.deepEqual(plan.map(({ name }) => name), ["api"]);
  });

  it("keeps a separator-bearing version out of the tag it would split", () => {
    // buildImagePlan itself does not validate — print-image-plan.mjs and the
    // workflow do — so this pins where such a version would land if it slipped
    // through, making the guards' necessity visible rather than implied.
    const [entry] = buildImagePlan([{ name: "api", version: "1.5.0,evil" }], "o/r");

    assert.equal(entry.image, "ghcr.io/o/r/api");
    assert.equal(entry.version, "1.5.0,evil");
  });

  it("returns nothing when no component changed", () => {
    assert.deepEqual(buildImagePlan([], "office-rivals/mmr-project"), []);
  });

  it("gives every component that has an image build context a docker context", () => {
    for (const component of components.filter(({ imageContext }) => imageContext)) {
      const [entry] = buildImagePlan([{ name: component.name, version: "9.9.9" }], "o/r");
      assert.equal(entry.context, component.imageContext, component.name);
    }
  });
});
