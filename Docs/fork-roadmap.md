# Fork Roadmap

This document tracks the maintenance strategy for the `nodlles/remodex` fork. The fork should stay local-first, self-host friendly, and reasonably easy to rebase or merge with upstream.

## Goals

- Keep Remodex usable from public source builds without relying on the original maintainer's hosted services or RevenueCat entitlement.
- Preserve the local-first architecture: Codex, git, and workspace operations run on the user's Mac; mobile acts as a paired controller.
- Improve self-host diagnostics, connection visibility, project safety, and Git safety.
- Keep fork-specific decisions explicit and isolated behind build/config switches where possible.
- Stay close enough to upstream that important fixes can still be merged regularly.

## Remotes

- `origin`: upstream project, `https://github.com/Emanuele-web04/remodex.git`
- `nodlles`: fork project, `https://github.com/nodlles/remodex.git`

Recommended remote usage:

```sh
git fetch origin
git fetch nodlles
```

Treat `origin/main` as upstream and `nodlles/main` as the fork's stable branch.

## Branch Strategy

- `main`: stable fork branch. Do not develop directly on it.
- `lixin/open-source-build`: public-source build configuration and first-pass CLI diagnostics.
- `lixin/fork-roadmap`: fork maintenance and planning documentation.
- `lixin/doctor-*`: CLI environment diagnostics improvements.
- `lixin/self-host-*`: self-hosting and local build documentation.
- `lixin/connection-*`: connection state, recovery, and diagnostics UI.
- `lixin/git-*`: Git safety and change-review improvements.
- `lixin/project-*`: project selection, cwd validation, and missing-folder recovery.
- `lixin/ios-*`: iOS build, signing, and mobile UX improvements.

Prefer small topic branches that can be reviewed, tested, merged, or dropped independently.

## Sync Workflow

Before starting new work:

```sh
git switch main
git fetch origin
git fetch nodlles
git merge --ff-only origin/main
git push nodlles main
git switch -c lixin/<topic>
```

After finishing a topic:

```sh
git diff --check
# Run relevant tests.
git commit -m "<type>: <summary>"
git push -u nodlles lixin/<topic>
```

Open PRs from `nodlles/lixin/<topic>` into `nodlles/main`.

## Completed Baseline

- Added `nodlles` remote.
- Created `lixin/open-source-build`.
- Added `REMODEX_OPEN_SOURCE_BUILD` build setting.
- Public source builds now skip RevenueCat setup.
- Public source builds keep app access enabled and do not consume the five free sends.
- Private/App Store builds can set `REMODEX_OPEN_SOURCE_BUILD = NO` through `PrivateOverrides.xcconfig`.
- Added initial `remodex doctor` command.
- Added bridge CLI tests for the doctor command.

## Phase 1: Local Build and Self-Host Readiness

Goal: make the fork easy to clone, build, install, and run locally.

Planned work:

- Add `Docs/local-build.md` for Xcode signing, Bundle ID changes, and source-build setup.
- Document `CodexMobile/BuildSupport/PrivateOverrides.xcconfig` clearly.
- Expand `remodex doctor` to check:
  - Xcode first-launch readiness.
  - Whether `xcodebuild -list -project CodexMobile/CodexMobile.xcodeproj` works.
  - Missing CoreSimulator/plugin errors with a direct remediation hint.
  - `CodexMobile.xcodeproj` presence.
  - `relay/package.json` and `phodex-bridge/package.json` presence.
  - `REMODEX_RELAY` format when set.
  - Whether the local relay health endpoint responds when using a local relay.
- Keep doctor checks read-only by default. Add fix commands only after checks are stable.

## Phase 2: Connection Observability

Goal: make connection failures explain which layer is broken.

Planned work:

- Add structured status for:
  - Relay reachability.
  - Bridge online/offline.
  - Secure session state.
  - Codex app-server availability.
  - Current project cwd validity.
  - Git repository validity.
- Improve App error cards with a layer, code, suggested action, and redacted details.
- Add copyable diagnostics summary in the iOS app.
- Improve `remodex status --json` and `remodex doctor --json` for companion tooling.

## Phase 3: Project and Git Safety

Goal: reduce risk when controlling Codex from a phone.

Planned work:

- Validate thread-bound project directories before sending new turns.
- Show a clear recovery UI when a project path is missing, moved, or outside allowed roots.
- Add project rebinding flow.
- Add commit preflight summary:
  - Modified/deleted/new file counts.
  - Untracked files.
  - Sensitive-looking filenames.
  - Current branch and upstream state.
- Add push preflight summary:
  - Remote and branch.
  - Ahead/behind state.
  - Protected/default branch warning.
- Require stronger confirmation for reset, stash pop, destructive revert, and protected branch operations.

## Phase 4: Mobile Agent Cockpit

Goal: make the iOS app feel like a remote agent control panel, not just a chat window.

Planned work:

- Add a project-centric home view with branch, dirty state, running-turn, and last-active indicators.
- Add a running tasks / waiting approvals overview.
- Improve timeline cards for:
  - Plans.
  - Tool calls.
  - File changes.
  - Git actions.
  - Errors.
  - Completion summaries.
- Collapse long reasoning, tool logs, and large diffs by default.
- Make completion notifications deep-link to the relevant thread/run.

## Phase 5: Long-Term Fork Maintenance

Goal: keep the fork sustainable.

Rules:

- Do not commit secrets, private relay URLs, APNs credentials, or personal signing files.
- Do not hardcode hosted-service assumptions in public source paths.
- Prefer build configuration over deleting upstream commercial features.
- Keep open-source defaults local-first and self-host friendly.
- Keep changes small and covered by tests where practical.
- Avoid large refactors until the fork has test coverage for the behavior being moved.
- Re-sync with upstream regularly and resolve conflicts while they are small.

## Near-Term Backlog

Suggested next branches:

1. `lixin/doctor-xcode-checks`
   - Detect the current Xcode/CoreSimulator issue seen on this machine.
   - Add focused CLI tests.

2. `lixin/local-build-docs`
   - Add an iOS source-build guide.
   - Include signing, Bundle ID, open-source build config, and local bridge notes.

3. `lixin/project-directory-guard`
   - Reintroduce project directory validation with structured errors and iOS recovery UI.

4. `lixin/git-preflight`
   - Add safer commit/push summaries before phone-triggered Git operations.

## Non-Goals for Now

- Do not rewrite the app from scratch.
- Do not turn the relay into a business-logic server.
- Do not make the phone a full IDE.
- Do not remove upstream RevenueCat/hosted-build paths; isolate them behind configuration.
- Do not do broad file/architecture rewrites until a specific pain point justifies them.
