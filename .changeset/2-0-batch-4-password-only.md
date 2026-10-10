---
'masir': major
---

### Removed

- Google and Microsoft sign-in, the `/api/auth/identities` routes,
  `GET /api/auth/providers`, the account settings page, and the five
  `NUXT_OAUTH_*` variables. A user who signed in only with a provider uses
  "Forgot password" to set a password.
