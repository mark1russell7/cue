# Release

[`RELEASING.md`](../RELEASING.md) tells how to publish a new version of `@mark1russell7/cue` to npm.

In short: change the version in `package.json` and `CHANGELOG.md`, and merge the change to `main`. The workflow `.github/workflows/release.yml` publishes the version with npm trusted publishing and a provenance statement. Then it makes the git tag `v<version>` and a GitHub release.
