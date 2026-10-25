# Releasing to npm

The workflow `.github/workflows/release.yml` publishes `@mark1russell7/cue` to npm. It is the standard release workflow of [mark1russell7/template](https://github.com/mark1russell7/template). It uses npm trusted publishing (OIDC), so it needs no npm token. Each version gets a provenance statement.

This repository has one published package: the root `package.json`.

## The workflow files

`release.yml` is short. Its jobs use the shared release workflows and the action `npm-publish` of the template ([`CI.md`](https://github.com/mark1russell7/template/blob/main/CI.md)):

| Job | What it uses |
|---|---|
| `verify` | The `ci.yml` of the repository. |
| `build` | `reusable-release-build.yml` of the template, with `scripts/release/pack.mjs` and `scripts/release/tags.mjs` of the repository. |
| `publish` | A job of `release.yml`. Its step is the action `npm-publish` of the template. |
| `tag` | `reusable-release-tag.yml` of the template. |

The job `publish` stays in `release.yml`. The trusted publisher of each package names this repository and `release.yml`. A composite action operates in the job that uses it, so npm sees the same workflow as before. The [`CI.md` of the template](https://github.com/mark1russell7/template/blob/main/CI.md) tells the reasons.

Each `uses:` of the template has a pin to a commit of `main`. Renovate does not change `release.yml`. The release session moves the pins ("Move the release pins").

## Move the release pins

A workflow change between the merge of a version and its release run makes the tag job fail with HTTP 403 ("Git tags and GitHub releases"). Thus Renovate does not change `release.yml` or `scripts/release/`. The release session moves the pins of `release.yml` each week, at a quiet time.

```sh
node scripts/release/bump-pins.mjs --dry-run <owner/repo> ...
node scripts/release/bump-pins.mjs --notes "<what the new commits bring>" <owner/repo> ...
```

The target is the head of `main` of the template. `--sha <commit>` sets a different commit of `main`. A name without an owner, for example `vex`, gets the owner `mark1russell7`.

For each repository, the script does these steps with the GitHub API (`gh api`). It makes no clone.

1. It reads `.github/workflows/release.yml` of `main`.
2. It finds each `mark1russell7/template/...@<commit> # main` pin.
3. It skips the repository when it has no pin, or when each pin is at the target.
4. It refuses the repository when a release can start (the check below).
5. It makes a branch, commits the new `release.yml` on it, and opens a pull request.
6. It shows the address of the pull request.

The text of the pull request lists the new commits of the template. `--notes` adds a paragraph. `--co-author` adds a `Co-Authored-By` line to the commit message. `--footer` adds a last line to the text of the pull request.

### The release check

The script refuses a repository in these conditions:

- An open pull request to `main` changes the `version` of a `package.json`. An example is the "Version the packages" pull request of Changesets.
- An open pull request is on a branch `release/<version>` or `changeset-release/<branch>`.
- A run of `release.yml` is queued, in progress or waiting.
- The script cannot do the check, for example after an error of GitHub.

After a refusal, the script goes to the next repository. The exit code is 1 when a repository has a refusal or an error. Start the script again for that repository later.

### The merge

A version pull request can open after the script made its pull request. Thus do the check again immediately before each merge:

```sh
node scripts/release/bump-pins.mjs --check <owner/repo> ...
```

When the result is `quiet`, merge the pull request with a squash merge after its checks pass. The next release uses the new pins.

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

## Only a commit on main

A release publishes only a commit that is on `main`. The first step of the build job compares the commit of the run with `main`, with the GitHub compare API. The commit must be the head of `main` or an older commit of `main`. For a different commit, the step fails. Then the run publishes nothing and makes no tag.

- A manual run on the branch of a pull request does not publish the code of that branch. Merge the pull request first.
- A temporary branch `release/<version>` at a version commit of `main` is correct. Use it to publish the version of an older commit when `main` has newer changes: `gh workflow run release.yml --ref release/<version>`.
- For a new trust, merge the pull request of the version first. Then start the release on `main` ("The trusted publisher").
- The input `require-main` of `reusable-release-build.yml` turns on the check. Its default is `true`. Only `actions-test.yml` of the template sets `false`, for the commits of pull requests.

## Git tags and GitHub releases

After the publish, the job `tag` of `release.yml` makes the git tag `v<version>` and a GitHub release for the version that the run published.

- The text of the release is the section of the version in `CHANGELOG.md`. Without a section, the text is one line with a link to npm.
- A version with a hyphen is a prerelease on GitHub. GitHub does not show it as the latest release.
- The field `latest` of the plan selects the latest release of a run. That release gets `--latest`, and the other releases get `--latest=false` ([`CI.md` of the template](https://github.com/mark1russell7/template/blob/main/CI.md)).
- When no entry sets `latest`, the job gives no `--latest` flag.
- The job skips each tag that exists. Thus a second run of the workflow does no harm.
- A run also tags a version that it did not publish, when npm has the version with a provenance statement from this repository. The tag goes on the commit that the provenance statement names.

The token of a workflow cannot change workflow files. Thus GitHub refuses a tag from the workflow (HTTP 403) when the workflow files of the commit differ from the workflow files of each branch. For example, the versions before this repository got the job `tag` get no tag from the workflow. For each refused tag, the summary of the run shows a `gh release create` command. Start it with your own GitHub token. The `RELEASING.md` of [mark1russell7/template](https://github.com/mark1russell7/template) tells all the rules.

## The trusted publisher

The trusted publisher of the package names this repository and the workflow file `release.yml`, with no GitHub environment. A new trust expires when no publish uses it in 2 days. Thus the owner changes the trust only on the day of a release:

```sh
node scripts/release/npm-bootstrap.mjs --dry-run
node scripts/release/npm-bootstrap.mjs --replace-trust --dispatch
```

The script reads `package.json` of `origin/main`. It replaces a trust that names a different workflow or environment, and sets "Require two-factor authentication and disallow tokens". With `--dispatch`, it starts `release.yml` on `main`. npm asks for the 2FA: the script opens the npm page in the browser.

The release publishes only a commit on `main`. Thus merge the pull request of the version before the change of the trust. `--dispatch` starts the release only in these two conditions:

- The script had no failure.
- The commit of `--ref` is on `main`. One `gh api` call to the compare API examines it.

Else the script shows the reason and the command `gh workflow run release.yml --repo <owner/repo> --ref main`. Start that command after the merge, in the 2 days of the trust.

## A publish that npm refuses

The action `npm-publish` gives a hint for two failures of the trusted publisher. The hints do not change the result of the step.

- The OIDC token exchange gives "package not found" or a 404 ([npm/cli#9969](https://github.com/npm/cli/issues/9969)). The cause is a trusted publisher that names a GitHub environment. npm cannot match it for a repository with the immutable OIDC subject. The trust must name no environment.
- `ENEEDAUTH`: npm got no token. The trusted publisher is missing, or it expired. A new trust expires when no publish uses it in 2 days.

For the two failures, the owner makes the trust again, and then starts the release:

```sh
node scripts/release/npm-bootstrap.mjs --replace-trust --dispatch
```

The script removes a trust that does not agree with `release.yml`, for example a trust with an environment. Then it adds a trust with no environment, because `release.yml` names none.

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
