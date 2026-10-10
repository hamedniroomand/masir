---
'masir': major
---

### Removed

- The demo workspaces, `POST /api/auth/demo`, and `NUXT_DEMO_ENABLED`.
- The in-app landing page. The documentation site is the public home page.
- Public registration, `/register`, `POST /api/auth/register`, and
  `NUXT_ALLOW_REGISTRATION`. New users join through an invitation.
- Turnstile and `NUXT_PUBLIC_TURNSTILE_SITE_KEY` and `NUXT_TURNSTILE_SECRET_KEY`.
- The `demosDeleted` field of `POST /api/jobs/alerts`.
