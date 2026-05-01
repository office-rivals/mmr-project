# Changelog

## 1.0.1

- Bump frontend, api, and mmr-api dependencies to the latest minor/patch
  within their current major. Includes Clerk JS SDK updates that pull in
  patches for GHSA-vqx2-fgx2-5wq9 (middleware route protection bypass)
  and GHSA-w24r-5266-9c3c (authorization bypass).

## 1.0.0

- Align mmr-api with the v3 release. The release script enforces a shared
  major across frontend, api, and mmr-api; without this bump the release
  PR job fails because frontend and api are moving to 1.0.0 while mmr-api
  would otherwise stay on 0.x. No behaviour changes in mmr-api itself.

## 0.1.0

- Set up Changesets-based releases and manual deployment from GitHub Releases.
