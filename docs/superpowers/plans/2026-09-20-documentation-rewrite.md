# Masir Documentation Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the published Masir documentation with a clear product, operations, reference, and contributor site for the first public release.

**Architecture:** Keep the existing public paths where they prevent broken links, but change their role in the navigation. `/guide/` becomes Get started, `/features/` becomes User guide, `/guide/self-hosting` anchors Self-hosting, `/reference/` stays Reference, and `/project/` becomes Contributing. Rewrite every published page from repository evidence, then apply one shared visual system through the current VitePress theme and components.

**Tech Stack:** VitePress 2, Vue 3, TypeScript, CSS, Mermaid, Markdown

**Spec:** `docs/superpowers/specs/2026-09-20-documentation-rewrite-design.md`

## Global Constraints

- Serve product users, self-hosting operators, API users, and contributors.
- Do not add product screenshots or stock illustrations.
- Use ASD-STE100 technical English, short sentences, active voice, and stable product terms.
- Validate product claims against code, tests, configuration, deployment files, and the database schema.
- Do not invent planned features.
- Do not add a dependency unless VitePress, Vue, CSS, and the current dependencies cannot provide the behavior.
- Preserve existing application behavior, routes, data, and environment defaults.
- Preserve existing documentation URLs when practical.
- Preserve unrelated working-tree changes in `compose.yaml` and `compose.image.yaml`.

---

### Task 1: Build the verified documentation inventory

**Files:**
- Read: `.env.example`
- Read: `package.json`
- Read: `nuxt.config.ts`
- Read: `compose.yaml`
- Read: `compose.image.yaml`
- Read: `vercel.json`
- Read: `server/api/**/*.ts`
- Read: `server/database/schema.ts`
- Read: `shared/permissions.ts`
- Read: `shared/link-status.ts`
- Read: `shared/link-targeting.ts`
- Read: `shared/deployment.ts`
- Read: `scripts/*.ts`
- Read: `scripts/*.sh`
- Read: `test/e2e/**/*.test.ts`
- Read: `test/unit/**/*.test.ts`
- Create: `docs/superpowers/plans/2026-09-20-documentation-source-map.md`

**Interfaces:**
- Consumes: The current repository at commit `bd6c985` plus the user's uncommitted Compose changes.
- Produces: A private implementation source map with verified facts for Tasks 2 through 7.

- [ ] **Step 1: Record the current graph generation and coverage**

Use the codebase memory graph to record the project name, branch, commit, route count, environment variables, and missed coverage. Check coverage for every source file used by the published docs.

- [ ] **Step 2: Map product behavior**

Record links, aliases, access rules, targeting order, analytics fields, tags, campaigns, workspaces, roles, authentication, storage, email, rate limits, and audit behavior. Cite the exact source file or test for each fact.

- [ ] **Step 3: Map operations behavior**

Record install paths, required versions, required variables, defaults, boot validation, migrations, health checks, proxies, storage, backups, scaling, monitoring, Vercel, and upgrades. Cite the exact configuration or deployment file for each fact.

- [ ] **Step 4: Map reference behavior**

Record every published API route, request method, authentication rule, role requirement, environment variable, package script, and database table. Mark internal-only routes so the public API page can state their status.

- [ ] **Step 5: Check the source map**

Run:

```sh
rg -n 'T[D]B|T[O]DO|unknown|verify later' docs/superpowers/plans/2026-09-20-documentation-source-map.md
```

Expected: no output.

---

### Task 2: Redesign the site shell and navigation

**Files:**
- Modify: `docs/.vitepress/config.ts`
- Modify: `docs/.vitepress/theme/index.ts`
- Modify: `docs/.vitepress/theme/style.css`
- Modify: `docs/.vitepress/theme/components/Card.vue`
- Modify: `docs/.vitepress/theme/components/CardGroup.vue`
- Modify: `docs/.vitepress/theme/components/ReadMore.vue`
- Modify: `docs/.vitepress/theme/components/Steps.vue`
- Modify: `docs/.vitepress/theme/components/Tab.vue`
- Modify: `docs/.vitepress/theme/components/Tabs.vue`
- Modify: `docs/.vitepress/theme/components/Mermaid.vue`
- Modify: `docs/.vitepress/theme/components/BrandPattern.vue`
- Modify: `docs/.vitepress/icons.ts`

**Interfaces:**
- Consumes: Existing `Card`, `CardGroup`, `ReadMore`, `Steps`, `Tabs`, and `Mermaid` components.
- Produces: Six top navigation entries, task-based sidebars, and shared visual styles for every page.

- [ ] **Step 1: Replace the navigation model**

Set the top navigation to Overview, Get started, User guide, Self-hosting, Reference, and Contributing. Group sidebar pages by reader task. Keep search, edit links, social links, and clean URLs.

- [ ] **Step 2: Simplify the theme integration**

Keep the default VitePress layout. Keep the current component names so rewritten Markdown pages need no compatibility wrapper. Remove component behavior that does not support the approved page model.

- [ ] **Step 3: Apply the visual system**

Use neutral surfaces, violet accents, clear content widths, compact navigation, strong heading rhythm, accessible focus styles, light and dark colors, reduced motion, and responsive layouts. Style cards, steps, tabs, callouts, code blocks, tables, sidebars, search, and pager links as one system.

- [ ] **Step 4: Build the shell**

Run:

```sh
bun run docs:build
```

Expected: the production documentation build completes without a broken link or Vue error.

---

### Task 3: Rewrite the homepage and getting-started path

**Files:**
- Modify: `docs/index.md`
- Modify: `docs/guide/index.md`
- Modify: `docs/guide/installation.md`
- Modify: `docs/guide/quickstart.md`

**Interfaces:**
- Consumes: The site shell from Task 2 and verified install facts from Task 1.
- Produces: The evaluation and first-run path linked from every audience entry point.

- [ ] **Step 1: Rewrite the homepage**

Add a compact product statement, the recommended install command, audience paths, key features, the deployment model, privacy facts, current limitations, and GitHub links. Use no screenshots.

- [ ] **Step 2: Rewrite the Get started overview**

Explain the three supported paths: published Docker image, local image build, and source development. Make the published image the recommended production path.

- [ ] **Step 3: Rewrite installation**

State prerequisites, exact secret generation, image and source procedures, first account creation, health verification, HTTPS requirements, and common startup errors.

- [ ] **Step 4: Rewrite the first-link tutorial**

Take the reader from sign-in through link creation, redirect verification, destination editing, analytics, and the audit history. Keep the API example as an optional final step.

- [ ] **Step 5: Build the getting-started path**

Run:

```sh
bun run docs:build
```

Expected: all four pages build and all internal links resolve.

---

### Task 4: Rewrite the user guide

**Files:**
- Modify: `docs/features/index.md`
- Modify: `docs/features/links.md`
- Modify: `docs/features/access-control.md`
- Modify: `docs/features/targeting.md`
- Modify: `docs/features/analytics.md`
- Modify: `docs/features/campaigns.md`
- Modify: `docs/guide/workspaces.md`
- Modify: `docs/guide/members.md`
- Modify: `docs/guide/authentication.md`

**Interfaces:**
- Consumes: Verified product and permission facts from Task 1.
- Produces: One task-focused page for each product area and cross-links to operator requirements.

- [ ] **Step 1: Rewrite the User guide overview**

Route readers by task. Separate daily link work, team administration, and account security.

- [ ] **Step 2: Rewrite links and access rules**

Document slugs, destinations, aliases, query passthrough, QR codes, notes, history, deletion, passwords, schedules, expiry, visit limits, fallbacks, and alerts.

- [ ] **Step 3: Rewrite targeting and analytics**

Document rule order, device and country inputs, proxy requirements, event fields, unique visitor method, bots, outcomes, privacy limits, and export behavior.

- [ ] **Step 4: Rewrite organization tools**

Document tags, campaigns, UTM values, campaign analytics, workspaces, workspace URLs, logos, activity history, and deletion.

- [ ] **Step 5: Rewrite members and authentication**

Document the owner, member, and viewer roles; invitations; role changes; deactivation; ownership transfer; email and password; OAuth; account linking; bot protection; registration; recovery; and email delivery.

- [ ] **Step 6: Build the user guide**

Run:

```sh
bun run docs:build
```

Expected: all user guide pages build and all internal links resolve.

---

### Task 5: Rewrite the self-hosting guide

**Files:**
- Modify: `docs/guide/self-hosting.md`
- Modify: `docs/guide/multi-workspace.md`
- Modify: `docs/guide/upgrading.md`
- Modify: `docs/guide/vercel.md`
- Modify: `docs/guide/troubleshooting.md`

**Interfaces:**
- Consumes: Verified deployment facts from Task 1 and the install path from Task 3.
- Produces: Production operation, upgrade, and incident guidance.

- [ ] **Step 1: Rewrite the self-hosting overview**

Explain the runtime shape, required configuration, root domain, short domain, HTTPS, reverse proxy headers, email, storage, backups, scaling, Sentry, and operator responsibilities.

- [ ] **Step 2: Rewrite multi-workspace operation**

Explain the mode switch, wildcard DNS, wildcard TLS, host resolution, the root domain, workspace switching, and local testing.

- [ ] **Step 3: Rewrite upgrades**

Give backup, version review, pull, restart, migration, health, rollback, skipped-version, and serverless steps. Keep the compatibility policy as the source for guarantees.

- [ ] **Step 4: Rewrite Vercel deployment**

Document the Bun runtime, build settings, Postgres, runtime variables, regions, geolocation headers, storage limits, and scheduled alert job.

- [ ] **Step 5: Rewrite troubleshooting**

Use symptom, likely cause, check, and fix for each verified failure mode. Include boot failure, database health, host resolution, cookie and OAuth loops, geolocation, Postgres clients, email, rate limits, stale redirect cache, and multi-instance issues.

- [ ] **Step 6: Build the self-hosting guide**

Run:

```sh
bun run docs:build
```

Expected: every operations page builds and every command matches a current script or deployment file.

---

### Task 6: Rewrite the reference

**Files:**
- Modify: `docs/reference/index.md`
- Modify: `docs/reference/api.md`
- Modify: `docs/reference/environment.md`
- Modify: `docs/reference/scripts.md`
- Modify: `docs/reference/data-model.md`
- Modify: `docs/project/compatibility.md`

**Interfaces:**
- Consumes: The verified route, configuration, script, schema, and compatibility inventory from Task 1.
- Produces: Exact references used by all guide pages.

- [ ] **Step 1: Rewrite the reference overview**

Explain the difference between guides and reference pages. Link to API, environment, scripts, data model, permissions, and compatibility information.

- [ ] **Step 2: Rebuild the HTTP API reference**

List each public route by method and path. State cookie authentication, CSRF and Origin requirements, workspace scope, role requirements, input shape, output shape, status codes, and one copyable request example per route group.

- [ ] **Step 3: Rebuild the environment reference**

List every supported variable once. Group by runtime concern. Include type, default, required condition, secret status, and restart requirement. Separate Compose helper values from Nuxt runtime values.

- [ ] **Step 4: Rebuild scripts and data model references**

List every package script and its prerequisites. Describe each database table, key constraint, tenant boundary, retention rule, and migration rule without duplicating generated SQL.

- [ ] **Step 5: Rewrite compatibility**

Keep the project upgrade guarantees. Make migration, configuration, route, session, stored hash, upload key, changelog, and release rules easy to scan.

- [ ] **Step 6: Build the reference**

Run:

```sh
bun run docs:build
```

Expected: the reference builds with no malformed table, broken anchor, or stale route link.

---

### Task 7: Rewrite contributor and project documentation

**Files:**
- Modify: `docs/project/index.md`
- Modify: `docs/project/architecture.md`
- Modify: `docs/project/security.md`
- Modify: `docs/project/development.md`

**Interfaces:**
- Consumes: Current architecture, security utilities, tests, scripts, and contribution rules.
- Produces: A contributor entry point and technical model that matches the current repository.

- [ ] **Step 1: Rewrite the contributor overview**

Explain the project values, stack, supported contribution areas, repository expectations, security reporting, and license.

- [ ] **Step 2: Rewrite architecture**

Document request routing, redirect evaluation, cache invalidation, analytics writes, database state, mail and storage drivers, deployment shapes, and multi-instance behavior. Use one Mermaid flow diagram.

- [ ] **Step 3: Rewrite security**

Document tenant scope, sessions, CSRF, password storage, destination validation, rate limits, uploads, abuse reports, privacy boundaries, excluded guarantees, and responsible reporting.

- [ ] **Step 4: Rewrite development**

Document prerequisites, setup, development services, repository layout, checks, unit tests, end-to-end tests, browser tests, migrations, docs, and the pull request checklist.

- [ ] **Step 5: Build contributor documentation**

Run:

```sh
bun run docs:build
```

Expected: all project pages build and the architecture diagram renders.

---

### Task 8: Complete publication checks

**Files:**
- Modify: `CHANGELOG.md`
- Delete: `docs/superpowers/plans/2026-09-20-documentation-source-map.md`
- Verify: `docs/**/*.md`
- Verify: `docs/.vitepress/**/*.{ts,vue,css}`

**Interfaces:**
- Consumes: All rewritten pages and theme files.
- Produces: A release-ready documentation site and a concise changelog entry.

- [ ] **Step 1: Add the changelog entry**

Add one `Unreleased` entry that states that the documentation site, navigation, and contributor guides were rewritten for the first public release.

- [ ] **Step 2: Remove implementation-only notes**

Delete the temporary source map. Keep the approved design and this implementation plan under the excluded `docs/superpowers/` path.

- [ ] **Step 3: Scan for editorial defects**

Run:

```sh
rg -n 'T[D]B|T[O]DO|lorem|as an AI|delve|seamless|game-changer|revolutionary' docs --glob '*.md' --glob '!plans/**' --glob '!superpowers/**'
```

Expected: no output.

- [ ] **Step 4: Run all static checks**

Run:

```sh
bun run docs:build
bun run lint
bun run typecheck
git diff --check
```

Expected: all commands exit with status 0.

- [ ] **Step 5: Inspect the built site**

Run the VitePress preview and inspect the homepage, installation, links, self-hosting, API, and architecture pages at desktop and mobile widths in light and dark modes. Check navigation, search, code copy, tables, callouts, keyboard focus, and reduced motion.

- [ ] **Step 6: Check the final change set**

Run:

```sh
git status --short
git diff --stat
git diff --check
```

Expected: only documentation, theme, plan, and changelog changes belong to this work. The existing user changes in `compose.yaml` and `compose.image.yaml` remain separate.
