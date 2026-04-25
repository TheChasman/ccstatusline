# Hostname Widget Design

## Summary

Add a `Hostname` widget to the Environment category that displays the friendly machine name — e.g. `Host: Kirk` or `Host: SpocksPad` — useful for distinguishing machines in a multi-machine workflow.

## Widget Spec

| Field | Value |
|---|---|
| Type | `hostname` |
| Display name | `Hostname` |
| Category | `Environment` |
| Default colour | `cyan` |
| Supports raw value | yes |
| Supports colours | yes |

## Rendering

**Normal mode:** `Host: <name>`  
**Raw value mode:** `<name>`  
**Preview:** `Host: Kirk`

### Name resolution

- **macOS:** `execSync('scutil --get LocalHostName', { encoding: 'utf8' }).trim()` — returns the Bonjour local hostname (e.g. `Kirk`, `SpocksPad`), which strips spaces and special characters from the computer name.
- **Other platforms (Linux, ChromeOS):** `os.hostname().split('.')[0]` — takes the short hostname before any domain suffix.

On error (e.g. `scutil` unavailable), fall back to `os.hostname().split('.')[0]`.

## Files

| Action | Path |
|---|---|
| Create | `src/widgets/Hostname.ts` |
| Edit | `src/widgets/index.ts` — add export |
| Edit | `src/utils/widget-manifest.ts` — register `hostname` type |
| Create | `src/widgets/__tests__/Hostname.test.ts` |
