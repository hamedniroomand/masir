# Changesets

A pull request that changes a migration, an env var, a route, or what users see adds a changeset.
Run `bun run changeset`, choose the bump (patch, minor or major) and write one or two sentences
that become the changelog entry. State what an operator must do, if anything. Commit the generated
file in `.changeset/` with the pull request.

Pull requests that users will not notice (docs, tests, CI, refactors) need none. Run
`bun run changeset --empty` to say so explicitly.

Maintainers: a workflow opens a "version packages" pull request from the changesets on `main`.
Merging it does not publish. Push the version tag to start `release.yml`.
