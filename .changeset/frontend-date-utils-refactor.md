---
"frontend": patch
---

Refactor date helpers in `src/lib/utils.ts` to remove duplication:
collapse the repeated null/empty/NaN guards behind a private
`parseLocalDate` helper, replace three local `formatDate`
redefinitions in `admin/members`, `admin/.../match-flags` and
`settings` with the shared one, and simplify the date-bucket boundary
check in `groupMatchesByDate`. Behaviour is unchanged except that the
admin match-flags page now formats dates in the user's locale instead
of forcing `en-US`.