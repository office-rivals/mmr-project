// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import rehypeBaseLinks from './src/plugins/rehype-base-links.mjs';

// GitHub Pages serves the project site under the repository name.
const base = '/mmr-project';

export default defineConfig({
  site: 'https://office-rivals.github.io',
  base,
  trailingSlash: 'always',
  markdown: {
    processor: unified({ rehypePlugins: [[rehypeBaseLinks, { base }]] }),
  },
  integrations: [
    starlight({
      title: 'MMR Project',
      description:
        'Self-hosted matchmaking and OpenSkill ratings for office games. Docs for the beta frontend.',
      logo: { src: './src/assets/crest.png', alt: '' },
      favicon: '/favicon.png',
      head: [
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}/apple-touch-icon.png` } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#01182e' } },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/office-rivals/mmr-project' },
      ],
      editLink: {
        baseUrl: 'https://github.com/office-rivals/mmr-project/edit/main/docs/',
      },
      customCss: [
        '@fontsource/chakra-petch/400.css',
        '@fontsource/chakra-petch/500.css',
        '@fontsource/chakra-petch/600.css',
        '@fontsource/chakra-petch/700.css',
        './src/styles/tokens.css',
        './src/styles/starlight.css',
      ],
      components: {
        SiteTitle: './src/components/starlight/SiteTitle.astro',
        ThemeProvider: './src/components/starlight/ThemeProvider.astro',
        ThemeSelect: './src/components/starlight/ThemeSelect.astro',
      },
      expressiveCode: {
        themes: ['github-dark-default'],
        styleOverrides: {
          borderRadius: '8px',
          borderColor: 'hsl(12 6.5% 15.1%)',
          codeBackground: 'hsl(20 14.3% 4.1%)',
          frames: {
            editorTabBarBackground: 'hsl(20 14.3% 4.1%)',
            terminalTitlebarBackground: 'hsl(20 14.3% 4.1%)',
            terminalBackground: 'hsl(20 14.3% 4.1%)',
          },
        },
      },
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Introduction', slug: 'introduction' },
            { label: 'Quick start', slug: 'quick-start' },
          ],
        },
        {
          label: 'Self-hosting',
          items: [
            { label: 'Overview', slug: 'self-hosting' },
            { label: 'Docker Compose', slug: 'self-hosting/docker-compose' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'Environment variables', slug: 'configuration/environment-variables' },
            { label: 'Authentication', slug: 'configuration/authentication' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Backups and upgrades', slug: 'operations/backups-and-upgrades' },
            { label: 'Observability', slug: 'operations/observability' },
          ],
        },
        {
          label: 'Features',
          items: [
            { label: 'Overview', slug: 'features' },
            { label: 'Organizations and leagues', slug: 'features/organizations-and-leagues' },
            { label: 'Match submission', slug: 'features/match-submission' },
            { label: 'Matchmaking', slug: 'features/matchmaking' },
            { label: 'Admin operations', slug: 'features/admin-operations' },
            { label: 'Foosball tables', slug: 'features/foosball-tables' },
            { label: 'Access control and tokens', slug: 'features/access-control-and-tokens' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Overview', slug: 'reference' },
            { label: 'API design', slug: 'reference/api-design' },
            { label: 'V3 migration guide', slug: 'reference/v3-migration-guide' },
            { label: 'Local development', slug: 'reference/local-development' },
          ],
        },
      ],
    }),
  ],
});
