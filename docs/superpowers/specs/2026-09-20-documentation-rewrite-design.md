# Masir documentation rewrite

## Goal

Rewrite the Masir VitePress site for its first public release. The site must
serve product users, self-hosting operators, API users, and contributors.

The new site must explain the product in plain language. It must help a new
reader evaluate Masir, install it, use it, operate it, integrate with it, and
contribute to it.

## Scope

This work includes all published VitePress pages, navigation, the homepage,
the theme, and custom documentation components. It can replace the current
information architecture and page paths.

The work also includes contributor documentation. It does not include product
screenshots. It does not change product behavior.

## Readers

The site serves these readers:

- A visitor who wants to learn what Masir does.
- A user who creates and manages links.
- An operator who installs and maintains Masir.
- A developer who uses the HTTP API.
- A contributor who changes the application or documentation.

No reader group is secondary. The homepage and navigation must give each
reader a clear starting point.

## Information architecture

The site follows the product lifecycle instead of the current broad content
types.

### Overview

- What Masir is.
- Core use cases.
- Feature summary.
- Deployment options.
- Current limitations.

### Get started

- Choose a deployment method.
- Install with Docker.
- Create the first account.
- Create and test the first link.
- Complete a production checklist.

### User guide

- Links and aliases.
- Access rules.
- Device and country targeting.
- Analytics.
- Tags and campaigns.
- Workspaces.
- Members and roles.
- Sign-in and account security.

### Self-hosting

- Requirements and architecture.
- Configuration.
- Domains, DNS, HTTPS, and reverse proxies.
- Email providers.
- Storage.
- Single-workspace and multi-workspace modes.
- Backups and recovery.
- Scaling.
- Monitoring and error reporting.
- Upgrades.
- Vercel.
- Troubleshooting.

### Reference

- HTTP API.
- Environment variables.
- Scripts.
- Data model.
- Permissions.
- Compatibility policy.

### Contributing

- Development setup.
- Repository structure.
- Tests.
- Database migrations.
- Documentation.
- Security policy.
- Release process.

The top navigation uses these six sections. Sidebars divide longer sections
into clear task groups. Old documentation paths redirect to the closest new
page where VitePress supports the redirect.

## Page model

Each page has one main reader task. A task page uses this order when it fits:

1. State the result.
2. List prerequisites.
3. Give the steps.
4. Show how to verify the result.
5. Explain common errors.
6. Link to the next task.

Reference pages use compact tables and exact values. Concept pages explain
one model and link to the task that uses it.

Pages must not repeat full procedures. They link to the single source for a
procedure instead.

## Editorial system

The docs use direct and natural English. They use short sentences, active
voice, and one term for each concept. They follow the project ASD-STE100
rules.

The docs avoid filler, slogans, vague claims, and artificial transitions.
Product claims must match the repository. Limitations must be explicit.

Commands must be ready to copy. Each placeholder must be clear. Every command
sequence must include a way to check the result when practical.

The rewrite must validate:

- Installation commands.
- Environment variable names and defaults.
- HTTP routes and request shapes.
- Roles and permissions.
- Link rules and redirect behavior.
- Deployment and upgrade behavior.
- Data model details.

## Visual system

The theme keeps the Masir violet identity. It uses neutral text, violet
accents, soft surfaces, strong spacing, and limited decoration.

The homepage includes:

- A compact product statement.
- The recommended install command.
- Starting points for each reader.
- A feature grid.
- A small architecture summary.
- Open-source project links.

The theme improves page headers, cards, steps, tabs, callouts, code blocks,
tables, sidebars, search, and previous and next links.

The site must work in light and dark modes. It must have visible keyboard
focus, sufficient contrast, reduced-motion behavior, and a usable mobile
layout.

The site does not use product screenshots or stock illustrations. It uses a
diagram only when the diagram makes a flow easier to understand than prose.

## Components

Reuse the current VitePress theme and custom components when they fit. Change
or remove them when the new page model needs a simpler component. Do not add a
dependency unless the current VitePress, Vue, or CSS stack cannot provide the
required behavior.

The implementation can add small components for page headers, audience paths,
or copyable commands. Each component must have one purpose.

## Content validation

The repository is the source of truth. The rewrite will compare the docs with
runtime configuration, API routes, database schema, permissions, deployment
files, scripts, tests, and the changelog.

When code and current docs disagree, the code and tests take priority. The
rewrite must not invent planned features.

## Verification

The completed rewrite must pass:

- The VitePress production build.
- Internal link validation from the VitePress build.
- Project lint for changed theme code.
- A search for stale paths, stale product terms, and placeholder text.
- A manual check of the homepage, one task page, one reference page, and one
  diagram in light, dark, desktop, and mobile layouts.

The final review must also compare the published environment, API, permission,
and compatibility references with the repository.

## Compatibility

This work changes user-visible documentation and navigation. Add an Unreleased
changelog entry. Keep old documentation URLs through redirects when practical.
Do not change application routes, stored data, environment defaults, or other
runtime behavior.
