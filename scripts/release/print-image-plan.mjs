// Prints one component's image build inputs as GITHUB_OUTPUT lines, so a
// workflow rebuilding a single release image reads the same component table the
// release itself is built from.
import { buildImagePlan } from "./create-releases.mjs";

const [name, version] = process.argv.slice(2);

if (!name || !version) {
  console.error("Usage: node ./scripts/release/print-image-plan.mjs <component> <version>");
  process.exit(1);
}

if (!process.env.GITHUB_REPOSITORY) {
  console.error("Error: GITHUB_REPOSITORY environment variable is required");
  process.exit(1);
}

const [entry] = buildImagePlan([{ name, version }], process.env.GITHUB_REPOSITORY);

if (!entry) {
  console.error(`Component ${name} publishes no container image`);
  process.exit(1);
}

console.log(`context=${entry.context}`);
console.log(`image=${entry.image}`);
console.log(`buildArgs=${entry.buildArgs}`);
