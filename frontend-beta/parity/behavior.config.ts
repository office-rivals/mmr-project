import shared from './playwright.config';

export default {
  ...shared,
  reporter: [['list']],
  outputDir: new URL('../test-results/behavior', import.meta.url).pathname,
  projects: shared.projects?.map((project) =>
    project.name === 'visual'
      ? { ...project, name: 'behavior', testMatch: /.*\.behavior\.spec\.ts/ }
      : project
  ),
};
