# Design register

This register points to approved feature decisions and checks that remain open. See the [README](../README.md) for the project overview and [development conventions](DEVELOPMENT.md) for implementation guidance. Agent entry points are [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md), [GEMINI.md](../GEMINI.md), and [WARP.md](../WARP.md).

| Area | Decision or check | Status | Source |
| --- | --- | --- | --- |
| Context Bar | Use a 25-cell Braille rail with dotted `⣀` track, adjacent green/amber/red filled bands, and a 10-cell minimum before omitting the rail. Keep the numeric readout and round alert boundaries only when displaying cells. | Implemented | [Colour bands design](superpowers/specs/2026-09-30-braille-colour-bands-design.md) |
| Context Bar | Verify Braille dot spacing and heavy vertical delimiter alignment in the user's iTerm2 font. Automated width tests cannot establish physical font rendering. | Open manual check | [Braille usage specification](ccstatusline-usage-upgrade.md#8-compatibility-and-risks) |
