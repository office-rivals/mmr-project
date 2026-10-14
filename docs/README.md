# Docs site

The landing page and documentation published to
<https://office-rivals.github.io/mmr-project/>, built with
[Astro](https://astro.build) and [Starlight](https://starlight.astro.build).
The site describes the beta frontend (`frontend-beta/`) and says so on every page.

```sh
npm ci
npm run dev          # http://localhost:4321/mmr-project/
npm run check        # type-check .astro and .ts files
npm run build        # writes dist/
npm run check:links  # fails on broken internal links in dist/
```

## Where things live

| Path                         | What                                                      |
| ---------------------------- | --------------------------------------------------------- |
| `src/pages/index.astro`      | Landing page; sections in `src/components/landing/`       |
| `src/content/docs/`          | Docs pages; the sidebar is defined in `astro.config.mjs`  |
| `src/components/mock/`       | HTML mock-ups of the beta app, used instead of screenshots |
| `src/styles/tokens.css`      | MMR Project design-system tokens (Dark theme only)        |
| `src/styles/starlight.css`   | Maps Starlight's theme onto the tokens                    |

## Writing pages

- Link to other pages root-absolute without the base path, with a trailing
  slash: `[Quick start](/quick-start/)`. A rehype plugin adds `/mmr-project`.
- Link to repository files with full GitHub URLs.
- To show the app, use a mock-up component in an `.mdx` page rather than a
  screenshot (see `src/content/docs/features/index.mdx`).
- This repository is public: never name a live deployment, real organization or
  league, or real user.

`main` deploys automatically through `.github/workflows/docs.yml`; pull
requests build and check the site without deploying.
