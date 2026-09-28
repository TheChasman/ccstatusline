# Design register

This register points to approved feature decisions and checks that remain open. See the [README](../README.md) for the project overview and [development conventions](DEVELOPMENT.md) for implementation guidance. Agent entry points are [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md), [GEMINI.md](../GEMINI.md), and [WARP.md](../WARP.md).

| Area | Decision or check | Status | Source |
| --- | --- | --- | --- |
| Context Bar | Use a 25-cell Braille rail with dotted `⣀` track, fill-only green/amber/red thresholds, and a 10-cell minimum before omitting the rail. Preserve the numeric readout. | Implemented | [Braille usage specification](ccstatusline-usage-upgrade.md) |
| Context Bar | Verify Braille dot spacing and heavy vertical delimiter alignment in the user's iTerm2 font. Automated width tests cannot establish physical font rendering. | Open manual check | [Braille usage specification](ccstatusline-usage-upgrade.md#8-compatibility-and-risks) |
