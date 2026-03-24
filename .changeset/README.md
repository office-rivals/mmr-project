# Changesets

Add a changeset for any change that should be included in a release.

Create a new `.md` file in this directory with YAML frontmatter specifying
which components are bumped and by what level:

```
---
"frontend": minor
"api": patch
---

Description of the change.
```

Valid components: `frontend`, `api`, `mmr-api`
Valid bump types: `major`, `minor`, `patch`
