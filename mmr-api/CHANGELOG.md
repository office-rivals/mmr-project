# Changelog

## 1.0.0

- Align mmr-api with the v3 release. The release script enforces a shared
  major across frontend, api, and mmr-api; without this bump the release
  PR job fails because frontend and api are moving to 1.0.0 while mmr-api
  would otherwise stay on 0.x. No behaviour changes in mmr-api itself.

## 0.1.0

- Set up Changesets-based releases and manual deployment from GitHub Releases.
