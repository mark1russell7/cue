# Releasing to npm

The workflow `.github/workflows/release.yml` publishes `@mark1russell7/cue` to npm. It is the standard release workflow of [mark1russell7/template](https://github.com/mark1russell7/template). It uses npm trusted publishing (OIDC), so it needs no npm token. Each version gets a provenance statement.

This repository has one published package: the root `package.json`.

## Who publishes

The owner (Mark) and one Claude session that the owner names are responsible for all npm publishes. Other Claude sessions obey these rules:

- Do not start `npm publish`, `pnpm publish`, `npm login`, `npm trust` or `npm access`.
- Do not change the npm settings of the package.
- Do not edit `release.yml` or the files in `scripts/release/`.
- Tell the owner the version and the SemVer reason of each version that you want on npm.

Other repositories install cue from git (`github:mark1russell7/cue`). Thus `dist/` stays in git, and the `prepare` script builds it.

## A release

1. Choose the next version with the SemVer rules.
2. Change `version` in `package.json`.
3. Add the changes to `CHANGELOG.md`, below a heading with the version.
4. Merge the change to `main`.

The push to `main` starts `release.yml`. The workflow starts the gates of `ci.yml`, builds and packs the package, and publishes the version if npm does not have it. A version with a hyphen, for example `1.2.0-rc.1`, gets the dist-tag `next`. The other versions get `latest`. You do not make a git tag. After the publish, the workflow makes the tag `v<version>` and a GitHub release.

To publish again after a failure, start the workflow by hand: `gh workflow run release.yml --ref main`. It skips a version that is on npm.

## Git tags and GitHub releases

After the publish, the job `tag` of `release.yml` makes the git tag `v<version>` and a GitHub release for the version that the run published.

- The text of the release is the section of the version in `CHANGELOG.md`. Without a section, the text is one line with a link to npm.
- A version with a hyphen is a prerelease on GitHub. GitHub does not show it as the latest release.
- The job skips each tag that exists. Thus a second run of the workflow does no harm.
- A run also tags a version that it did not publish, when npm has the version with a provenance statement from this repository. The tag goes on the commit that the provenance statement names.

The token of a workflow cannot change workflow files. Thus GitHub refuses a tag from the workflow (HTTP 403) when the workflow files of the commit differ from the workflow files of each branch. For example, the versions before this repository got the job `tag` get no tag from the workflow. For each refused tag, the summary of the run shows a `gh release create` command. Start it with your own GitHub token. The `RELEASING.md` of [mark1russell7/template](https://github.com/mark1russell7/template) tells all the rules.

## The trusted publisher

The trusted publisher of the package names this repository and the workflow file `release.yml`, with no GitHub environment. A new trust expires when no publish uses it in 2 days. Thus the owner changes the trust only on the day of a release:

```sh
node scripts/release/npm-bootstrap.mjs --dry-run
node scripts/release/npm-bootstrap.mjs --replace-trust --dispatch
```

The script reads `package.json` of `origin/main`. It replaces a trust that names a different workflow or environment, and sets "Require two-factor authentication and disallow tokens". With `--dispatch`, it starts `release.yml`. npm asks for the 2FA: the script opens the npm page in the browser.

## The state of the package

```sh
node scripts/release/npm-audit.mjs
```

The audit uses only public data. It shows the latest version, if a trusted publisher published it, and if `main` has a version that is not on npm.

## Check a version before the release

```sh
pnpm build
npm pack
npx publint ./mark1russell7-cue-<version>.tgz --strict
npx @arethetypeswrong/cli ./mark1russell7-cue-<version>.tgz --profile esm-only
```
