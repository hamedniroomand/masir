---
'masir': major
---

### Removed

- Multi-workspace mode, workspace subdomains, and the workspace switcher. One
  install serves one workspace. Short links on workspace subdomains stop
  working. Short links on `NUXT_PUBLIC_SHORT_DOMAIN` keep working.
- `POST /api/workspaces`, `DELETE /api/workspaces`, and
  `GET /api/workspaces/slug-available`.
- `NUXT_DEPLOYMENT_MODE`, `NUXT_MULTI_WORKSPACE`, `NUXT_APP_DOMAIN`,
  `NUXT_SESSION_COOKIE_DOMAIN`, and `NUXT_RATE_LIMIT_WORKSPACE_PER_DAY`, and
  `NUXT_RATE_LIMIT_SLUG_CHECK_PER_MINUTE`. The app ignores them when they are
  set.
- The `multiWorkspace` field of `GET /api/workspaces`.
- The `/no-access` page is new, so `no-access` is now a reserved slug. A short link or link prefix named `no-access` stops working. Rename it before the upgrade.
