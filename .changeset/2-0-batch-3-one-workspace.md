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
  `NUXT_SESSION_COOKIE_DOMAIN`, and `NUXT_RATE_LIMIT_WORKSPACE_PER_DAY`. The
  app ignores them when they are set.
- The `multiWorkspace` field of `GET /api/workspaces`.
