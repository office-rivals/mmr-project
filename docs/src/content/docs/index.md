---
title: Office Rivals Docs
description: Learn how to self-host, configure, operate, and use Office Rivals.
---

Office Rivals is a self-hostable app for running competitive leagues inside organizations. The current stack is:

- a SvelteKit frontend in [`frontend/`](https://github.com/office-rivals/mmr-project/tree/main/frontend)
- an ASP.NET Core API in [`api/MMRProject.Api/`](https://github.com/office-rivals/mmr-project/tree/main/api/MMRProject.Api)
- a Go-based MMR calculation service in [`mmr-api/`](https://github.com/office-rivals/mmr-project/tree/main/mmr-api)
- PostgreSQL for persistent data

The docs are organized around the jobs an operator or team admin actually needs to do:

- deploy the stack
- configure authentication and environment variables
- understand the tenant model
- run upgrades safely
- understand the product capabilities and security boundaries

![Office Rivals docs site](/screenshots/docs-home.png)

_The Starlight docs site is structured around deployment, configuration, operations, features, and lower-level reference material._

## Recommended Reading Order

1. Start with [Quick Start](/quick-start/)
2. Continue to [Self-Hosting Overview](/self-hosting/)
3. Configure your instance with [Environment Variables](/configuration/environment-variables/)
4. Set up [Authentication](/configuration/authentication/)
5. Review [Backups and Upgrades](/operations/backups-and-upgrades/)
6. Explore the [Features](/features/)

## Core Concepts

- **Organization**: the top-level tenant boundary
- **League**: a competitive space within an organization
- **Organization membership**: a person’s role and identity inside an organization
- **League player**: an organization member who participates in a specific league
- **Personal access token**: an API credential scoped to a tenant boundary

## Who This Is For

- Operators self-hosting Office Rivals for their company or community
- Team admins setting up organizations, leagues, and invites
- Developers integrating with the API or contributing to the project

## Current Hosting Reality

Office Rivals is self-hostable, but authentication is currently tied to Clerk. That means you can run the app and API yourself while still depending on a Clerk application for sign-in and JWT issuance.

If you need a fully self-contained auth stack, that is not documented here because the current codebase does not ship an alternative auth provider implementation.
