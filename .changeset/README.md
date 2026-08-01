# Changesets

Add a changeset for any change that should be included in a release.

Create a new `.md` file in this directory with YAML frontmatter specifying
which components are bumped and by what level:

```yaml
---
"frontend": minor
"api": patch
---

Description of the change.
```

Valid components: `frontend`, `api`, `mmr-api`
Valid bump types: `major`, `minor`, `patch`

## Writing the description

The description becomes a bullet in the component's `CHANGELOG.md` and in the
GitHub Release, so write it for someone deciding whether a release affects
them — not as a summary of the diff.

**Keep it to one or two sentences.** Lead with what changed for the user, in
the imperative ("Show admins…", "Hide not-yet-started seasons…"). Name a new
endpoint or config flag if callers need to know about it. Leave out
implementation detail, request ordering, file names, and rationale — the PR and
the commits hold those.

```markdown
Show admins a red badge wherever match flags are waiting to be resolved, backed
by a new `GET /api/v3/me/badges`.
```

Not:

```markdown
Surface unresolved match flags to admins with red badges across the nav. A new
endpoint returns open-flag counts (total plus per-organization and per-league)
for the organizations a user administers, so the account/settings control, the
Admin menu item, the admin organization list, the org sidebar, the leagues list
and the league sub-nav all show a count. The frontend fetches it alongside the
existing profile load, replacing the previous per-league fan-out. …
```

A long entry also tends to drift: the more it describes *how* something works,
the more likely it contradicts the code by the time it ships.
