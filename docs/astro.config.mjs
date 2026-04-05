import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Office Rivals Docs',
      description: 'Self-hosting, configuration, operations, and feature guides for Office Rivals.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/office-rivals/mmr-project' },
      ],
      sidebar: [
        {
          label: 'Start Here',
          items: [
            { label: 'Introduction', slug: '' },
            { label: 'Quick Start', slug: 'quick-start' },
          ],
        },
        {
          label: 'Self-Hosting',
          items: [
            { label: 'Overview', slug: 'self-hosting' },
            { label: 'Docker Compose', slug: 'self-hosting/docker-compose' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'Environment Variables', slug: 'configuration/environment-variables' },
            { label: 'Authentication', slug: 'configuration/authentication' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Backups and Upgrades', slug: 'operations/backups-and-upgrades' },
          ],
        },
        {
          label: 'Features',
          items: [
            { label: 'Overview', slug: 'features' },
            { label: 'Organizations and Leagues', slug: 'features/organizations-and-leagues' },
            { label: 'Match Submission', slug: 'features/match-submission' },
            { label: 'Matchmaking', slug: 'features/matchmaking' },
            { label: 'Access Control and Tokens', slug: 'features/access-control-and-tokens' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Reference Index', slug: 'reference' },
            { label: 'API Design', slug: 'reference/api-design' },
            { label: 'V3 Migration Guide', slug: 'reference/v3-migration-guide' },
          ],
        },
      ],
    }),
  ],
});
