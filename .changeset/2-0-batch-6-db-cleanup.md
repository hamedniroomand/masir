---
'masir': major
---

### Upgrade notes

- Back up the database before the upgrade. The 2.0 migration deletes data,
  and Masir has no down migrations.
- Masir 2.0 serves one workspace. The migration stops when more than one live
  workspace exists. On 1.x, keep one workspace and delete the others. Stay on
  1.x if you need several workspaces.
- The migration permanently deletes soft-deleted workspaces with their links,
  Google and Microsoft sign-in records, and email verification tokens.
- Stop every instance before the upgrade. 1.x code does not work against the
  2.0 schema, so a rolling deploy is not supported for this release.
- You can delete the removed environment variables. The app ignores them.
- The `x-vercel-ip-country` fallback is gone. Set `NUXT_GEO_COUNTRY_HEADER` if your proxy sends the country in another header.

### Changed

- The 2.0 migration drops the workspace plan, trial, subscription, demo
  expiry, and deletion columns, and the user email verification and avatar
  columns.
