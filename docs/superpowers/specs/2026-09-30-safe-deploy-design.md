# Safe local deploy

## Problem

The build emits multiple JavaScript files. TUI save copies only the entry file, so a changed entry can reference chunks that were never deployed. The package `deploy` command removes deployed scripts before copying replacements, leaving a failure window. There is no simple `deploy.sh` entry point.

## Design

- Add an executable root `deploy.sh` that runs the existing TypeScript deploy routine and exits nonzero on failure. Point `bun run deploy` to it.
- Make `writeStaticFiles` copy every emitted `.js` file from `dist/` into `~/.config/ccstatusline/`, with the entry file replaced last. Each file is copied to a temporary peer, then atomically renamed. Preserve settings, package metadata, and old chunks; old chunks can still be in use by running processes.
- Keep the `~/.bun/bin/ccstatusline` symlink management in the existing routine. Both TUI save and `deploy.sh` use that same routine. A failed build or missing entry leaves the installed entry untouched.

## Verification

Tests cover multiple chunks and failure before entry replacement. Run targeted tests, lint, build, and a local `deploy.sh` smoke check. Do not publish or push.
