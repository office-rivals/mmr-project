---
"frontend": patch
---

Remove the unused v1 API client. The frontend has fully migrated to the v3
client (`$api3`); the v1 client (`src/api`, `apiClient.ts`, the `$api` alias,
and the `locals.apiClient` injection) was still wired up but consumed by no
route, and the API no longer serves the `/swagger/v1/swagger.json` spec the
`generate-api` script targeted. Delete the dead client and repoint
`generate-api` at the v3 spec. No behavioural change.
