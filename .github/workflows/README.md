# Workflows status

Ported from `wso2/vscode-extensions` and `ballerina-platform/ballerina-language-server`,
then pruned to a ballerina-only monorepo. Paths have been rewritten to the new layout
(`packages/ballerina-extension`, `submodules/wso2-vscode-extensions/workspaces/common-libs/`).

## Ballerina language server workflows

| File | Source | Trigger |
|---|---|---|
| `ls-publish-release.yml` | ballerina-language-server repo | manual release |

(The LS PR build, daily build and Trivy scan are merged into `pull-request.yml` and
`daily-build.yml`; there are no separate `ls-build-master.yml` / `ls-trivy.yml`
workflows in this repo.)

Each has `defaults.run.working-directory: packages/ballerina-language-server` injected so
`./gradlew …` steps resolve correctly from repo root.

## VSCode extension workflows

| File | Trigger | Notes |
|---|---|---|
| `build.yml` | `workflow_call` only | Reusable build pipeline (ballerina-only) |
| `daily-build.yml` | nightly cron + manual | Syncs the `nightly` branch, runs the LS multi-branch pack/test/Windows-build matrix **and** calls `build.yml` for the extension, publishes the rolling `nightly` GitHub pre-release, then dispatches success/failure notifications. See [Versioning](#versioning) and [The nightly branch](#the-nightly-branch) |
| `pull-request.yml` | PRs + manual | Detects changes with `dorny/paths-filter`; if anything build-relevant changed, runs `build.yml` which builds the entire chain (LS via Gradle, then all TS packages and the extension VSIX via rush) in a single job. Windows LS coverage runs in `daily-build.yml` only. |
| `release-vsix.yml` | manual dispatch | Builds, creates GitHub release, opens version-bump PR back to `stable/ballerina` |
| `publish-vsix.yml` | manual dispatch | Publishes a built VSIX (passed by `workflowRunId`) to VSCode Marketplace + OpenVSX |
| `cache-cleanup.yml` | PR closed + manual | Generic — usable as-is |
| `sync-main-with-releases.yml` | PR merged to `stable/ballerina**` | Opens an auto-sync PR back to `main` |

## Versioning

The **root `package.json` `version` field is the single source of truth** for the
shipped version, and on `main` it always carries the *next* release as a snapshot:
`major.minor.patch-SNAPSHOT` (e.g. `5.14.0-SNAPSHOT`). `-SNAPSHOT` is never shipped —
every publishable build derives a concrete version from it, and `updateVersion` fails
the build if one reaches packaging with the suffix intact.

**It is the only version anyone edits.** Two files carry a **generated** copy of it, both written by
`common/scripts/sync-version.js`, which each project chains at the head of its own `build`
script so the value is refreshed before anything reads it:

| Generated file | Consumed by |
|---|---|
| `packages/ballerina-extension/package.json` (`version`) | `vsce`, which packages it off disk as it always has — that manifest ships inside the VSIX as `extension/package.json` |
| `packages/ballerina-language-server/gradle.properties` (`version=`) | Gradle, via the ordinary `allprojects { version = project.version }` — no version logic in `build.gradle` |

`-Pversion=<v>` overrides the Gradle side for a one-off build, by normal Gradle precedence
(a command-line property beats `gradle.properties`). That is how `ls-publish-release.yml`
and the daily-build LS matrix pin a version, and it needs no code in `build.gradle`.

Because the sync runs at the *start* of every build, **editing either generated file by hand
has no effect** — the next build overwrites it. That is deliberate: a stale or hand-edited
copy reaching an artifact is exactly the failure this design removes.

The guarantee is scoped to builds that go through rush/pnpm. A bare `./gradlew pack`
invoked directly uses whatever `gradle.properties` currently holds, since nothing has run
the sync — so build the LS with `rush build --to ballerina-language-server` (or run
`node common/scripts/sync-version.js` first) when the root version has moved.

Packaging itself goes through the shared
`submodules/.../common-libs/scripts/package-vsix.js`, unchanged. The extension's `postbuild`
does add one step before it, `clearVsix`, which deletes previously built VSIXes from the
package root and `vsix/`. Without it they accumulate: `vsce` only overwrites a file of the
*same* name, and `copyVSIX` (`copyfiles *.vsix ./vsix`) then copies every root VSIX forward,
so one file per version ever built piles up in both places. That is not cosmetic — e2e
resolves the VSIX to install by newest mtime across those folders
(`e2e-test/.../utils/helpers/setup.ts`), and a set copied in one pass shares a timestamp, so
the winner is undefined and a run can install a months-old build.

Its glob is `ballerina-[0-9]*.vsix`, requiring a digit after the dash so it can never match
`ballerina-integrator-*.vsix` — which really can sit in `vsix/`, because the e2e prerelease
path downloads it there (`test.list.ts`). `setup.ts` makes the same exclusion.

`.github/actions/updateVersion` is the only place the version is mutated, and the root
`package.json` is the only file it touches. It applies an optional explicit override, then
derives the version for the build type.

| Build | Version | Example (from `5.14.0-SNAPSHOT`) | `vsce --pre-release` |
|---|---|---|---|
| PR / local | untouched | `5.14.0-SNAPSHOT` (never packaged) | no |
| Nightly | `major.(minor-1).<yymmddHHmm>` | `5.13.2607290130` | **no** — see below |
| Pre-release (`release-vsix.yml`, `isPreRelease: true`) | `major.(minor-1).<yymmddHHmm>` | `5.13.2607290145` | yes |
| Release | root version minus `-SNAPSHOT` | `5.14.0` | no |

Nightlies and pre-releases share one derivation (`common/scripts/nightly-version.js`),
which **decrements the minor** so the version sorts above every real release of the
previous line (`5.13.4` < `5.13.2607290130`) and below the release `main` is heading for
(`5.13.2607290130` < `5.14.0`). Publishing either as `5.14.x` would make it outrank the
eventual `5.14.0` and VS Code would never update off it. The timestamp is
minute-granular so a nightly and a pre-release cut on the same day cannot collide.

The script hard-fails on a root version that is not `major.minor.patch-SNAPSHOT` — so
dispatching a pre-release from a branch carrying a concrete version stops with an
explicit error instead of producing an unordered one — and on a minor of `0` (there is
no `minor - 1` to publish under; a new major line needs a human decision).

After a release, `.github/actions/pr` opens a PR returning `main` to
`major.(minor+1).0-SNAPSHOT`. That is not cosmetic: leave `main` on a concrete version
and the next nightly fails, because the derivation requires a snapshot.

A note on `npm version`: the version is always written through it and **read back** from
`package.json` rather than reusing a composed string, because npm normalizes on write
(notably stripping a leading zero that an appended timestamp can produce, which is not
strict semver).

Nightlies deliberately pass `isPreRelease: false`. That input does more than pick a
version suffix: it is exported into the rush build env, where
`common-libs/scripts/package-vsix.js` turns it into `vsce package --pre-release`, and
that flag moves whoever installs the VSIX onto the Marketplace pre-release channel for
future updates. A nightly is unvetted `main`, not an opt-in supported channel.

## The nightly branch

`daily-build.yml` builds from a `nightly` branch that it maintains itself: every run
resets it to `origin/main`, commits the timestamped version, and force-pushes. So
`git diff main nightly` is always exactly the version bump, and every nightly VSIX has
one commit that pins both its source and its version.

- **Never open a PR against `nightly` and never merge it anywhere** — it is discarded
  and recreated daily.
- The extension build is pinned to the nightly *commit SHA*, not the branch name, so a
  concurrent run cannot swap the tree mid-build. The build does not re-stamp the
  version; the commit is authoritative (re-deriving the timestamp would produce a
  different version as soon as the clock ticked past the minute).
- The version commit carries the root `package.json` plus both generated files, so the
  nightly commit is internally consistent and the jar built from it carries the nightly
  version.
- The force-push uses `GITHUB_TOKEN`, whose pushes do not trigger workflows, so the
  daily build cannot re-enter itself.

The rolling `nightly` GitHub pre-release carries two assets — the VSIX and the bundled
LS jar — replaced in place (upload-then-rename, old asset deleted only after the new
one is verified) so the download URLs keep working even if a run fails.

## The bundled language server

The jar in `packages/ballerina-extension/ls/` is **always** the `pack` output of
`packages/ballerina-language-server` in this repo, copied by `scripts/copy-ls.js` during
`postbuild`. There is no download fallback and no way to select a different LS: a
prebuilt jar from elsewhere could not carry this repo's version, so a VSIX built around
one would ship an extension and a server claiming different versions.

Consequence: building the extension requires being able to build the LS — JDK 21 and
GitHub Packages credentials (`packageUser` / `packagePAT`). If the jar is missing,
`copy-ls.js` fails with instructions rather than silently substituting one.

`ls-publish-release.yml` publishes `io.ballerina:ballerina-language-server` at the same
parent version. It does not run Gradle's `release` task: that task rewrote the `version=`
key in `gradle.properties`, which no longer exists now that the root `package.json` owns
the version.

## Required GitHub secrets

- `BALLERINA_BOT_USERNAME` / `BALLERINA_BOT_EMAIL` / `BALLERINA_BOT_TOKEN` — LS publish workflow (git identity + write to `ballerina-platform` packages + releases)
- `BALLERINA_CENTRAL_ACCESS_TOKEN` — LS publish to Ballerina Central
- `VSCE_TOKEN` — publish-vsix → VSCode Marketplace
- `OPENVSX_TOKEN` — publish-vsix → OpenVSX
- `BI_TEAM_CHAT_API` — daily build success + release announcements (pre-release and final)
- `EDITOR_TEAM_CHAT_API` — threaded release progress, build/sync failures
- `CLOUD_EDITOR_BUILDER_REPO` / `CLOUD_EDITOR_BUILDER_REPO_TOKEN` — optional cross-repo dispatch on stable release (publish-vsix)
- `COPILOT_ROOT_URL` / `COPILOT_DEV_ROOT_URL` / `APPINSIGHTS_INSTRUMENTATION_KEY` — passed through to the build composite action

Configure these in the new repo's settings before triggering anything.

## Composite actions under `.github/actions/`

| Action | Used by |
|---|---|
| `build` | `build.yml` — runs rush install + `rush build --to ballerina` |
| `updateVersion` | `build`, `daily-build.yml` — resolves the version from the root `package.json` and propagates it |
| `release` | `release-vsix.yml` — creates GitHub release with the VSIX; `daily-build.yml` — rolling `nightly` release with the VSIX + LS jar |
| `pr` | `release-vsix.yml` — opens version-bump PR + Google Chat notification |
| `dailyBuildNotification` | `daily-build.yml` — success chat notification |
| `failure-notification` | `daily-build.yml`, `release-vsix.yml` — failure chat notification |
