---
'masir': minor
---

Add `NUXT_READ_ONLY_EMAILS`. A user in this list sees every page that the owner and an operator see: workspace settings, members, the activity log, and system status. The server refuses each change from this user with 403, and the app shows a read-only banner. Many visitors can share one read-only account, so its sign-in skips the limit for each email. The limit for each client stays. "Forgot password" sends no mail to a read-only account. The default is empty, so no user changes.

Add `bun run db:seed:demo`. It fills an empty workspace with sample members, links, campaigns, clicks, and activity, for a demo install.
