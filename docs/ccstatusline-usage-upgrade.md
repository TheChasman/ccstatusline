# Feature Spec: High-Resolution Braille Usage Bar

**Status:** Approved for implementation
**Target:** Claude Code status line (ccstatusline-style widget or standalone script)
**Author:** Chas / Leo
**Date:** 2026-09-28

---

## 1. Summary

Replace the current context-usage bar (whole block cells plus a single shade cell, wrapped in square brackets) with a Braille-filled bar delimited by heavy vertical lines. Each cell carries 8 dot-steps instead of roughly 1, so the fill tracks context consumption with far finer resolution.

**Current:**

```
Ctxt: [██████████▒▒▒▒     ] 182k/239k
```

**Proposed (illustrative, 25 cells, shown at 1-20%):**

```
Ctxt: ┃⡄⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  1%
Ctxt: ┃⣿⣿⡄⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  9%
Ctxt: ┃⣿⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 20%
```

---

## 2. Goals

- Sub-cell precision: a visible change for every 1% (or better) of context used.
- Heavy vertical delimiters (`┃`, U+2503) in place of `[` and `]`.
- Retain the existing numeric readout (`182k/239k`) and threshold colouring.
- Work in iTerm2 with the user's current monospace font; degrade gracefully elsewhere.

## 3. Non-Goals

- Changing how context usage is measured.
- Multi-line or graph-style output (sparklines, history). Out of scope for this iteration.
- Replacing the MCP / terminal indicators elsewhere in the status line.

---

## 4. Character Set

### 4.1 Braille fill ramp (per cell)

Dots fill the left column bottom-to-top, then the right column bottom-to-top. Braille dot bits: dot 1 = 0x01, 2 = 0x02, 3 = 0x04, 4 = 0x08, 5 = 0x10, 6 = 0x20, 7 = 0x40, 8 = 0x80.

| Steps | Glyph | Code point | Dots lit        |
|------:|:-----:|:-----------|:----------------|
| 0     | `⠀`   | U+2800     | none (blank)    |
| 1     | `⡀`   | U+2840     | 7               |
| 2     | `⡄`   | U+2844     | 3, 7            |
| 3     | `⡆`   | U+2846     | 2, 3, 7         |
| 4     | `⡇`   | U+2847     | 1, 2, 3, 7      |
| 5     | `⣇`   | U+28C7     | + 8             |
| 6     | `⣧`   | U+28E7     | + 6             |
| 7     | `⣷`   | U+28F7     | + 5             |
| 8     | `⣿`   | U+28FF     | + 4 (full)      |

### 4.2 Delimiters

- Left and right: Box Drawing Heavy Vertical, `┃` (U+2503).
- Rendered dim or in a neutral grey so they frame the bar without competing with the fill.

### 4.3 Track (unfilled cells)

- The approved default is `⣀` (U+28C0). It is the same advance width as filled Braille glyphs, so the closing delimiter stays aligned. A plain space is not used.
- Use a faint dotted track (`⣀`, U+28C0) in dark grey so the empty region reads as a visible rail. If the locale is not UTF-8, use an ASCII `-` track.

---

## 5. Rendering Algorithm

**Inputs:** `used` (tokens), `limit` (tokens), `width` (cells, default 25).

```
total_steps = width * 8
steps       = floor(used / limit * total_steps)      # clamp to [0, total_steps]
full        = steps / 8                              # integer division
rem         = steps % 8

cells = full x "⣿"
      + (full < width && rem > 0 ? ramp[rem] : "")
      + (width - full - (rem > 0 ? 1 : 0)) x "⣀"   # if full < width

output = "┃" + cells + "┃"
```

Notes:

- **Rounding:** use floor, so the bar never over-reports usage. Exception: if `used > 0` and `steps == 0`, show one step so non-zero usage is never invisible.
- **Clamping:** `used > limit` renders a full bar.
- **Default width:** 25 cells gives 200 steps, exactly 2 steps per percent, which keeps the 1-20% mock-up visually even. Width is configurable.
- **Zero limit / missing data:** render an empty track and omit the numeric readout rather than dividing by zero.
- Use raw `context_window.current_usage` token counts with `context_window.context_window_size` when present. Preserve the existing transcript and percentage fallbacks when those counts are unavailable.

---

## 6. Colour

Colour is applied with Select Graphic Rendition (SGR) escape sequences and is independent of glyph choice.

| Usage   | Fill colour (fg) | Notes                                   |
|:--------|:-----------------|:----------------------------------------|
| < 50%   | green            | 256-colour or truecolor, configurable   |
| 50-74%  | amber            |                                         |
| >= 75%  | red              | Matches the current red state at ~76%   |

- Thresholds and colours must be configurable.
- The Context Bar widget stores optional `brailleWidth`, `brailleWarningAt`, `brailleCriticalAt`, `brailleLowColor`, `brailleMediumColor`, and `brailleHighColor` strings in its existing `metadata` object. Invalid values fall back to defaults (25 cells, 50%, 75%, green, amber, red).
- Delimiters: dim grey (`\e[38;5;244m` or equivalent).
- Use three threshold colours; no per-cell gradient. Only the Braille fill changes colour at high usage. The label and numeric readout do not acquire a warning background.
- Always reset attributes (`\e[0m`) after the bar so colour never leaks into adjacent widgets.

---

## 7. Layout

```
Ctxt: ┃<bar>┃ 182k/239k
```

- Label, bar, then the numeric readout, as now.
- Keep the numeric readout untruncated where width allows. The current display shows `182k/239...`, so truncation appears to be happening at the right edge. Consider shortening the bar width dynamically to protect the readout.
- Bar width shrinks on narrow terminals (minimum 10 cells) and is dropped entirely below that, leaving the numeric readout only. The line renderer accounts for neighbouring widgets before truncating the line.

---

## 8. Compatibility and Risks

- **Font rendering:** Braille glyphs are supported by most modern monospace fonts, but some draw the dots at different sizes or fall back to a different font, breaking cell alignment. Verify in iTerm2 with the user's actual font.
- **Braille track:** some fonts or terminals render dots at a different width. Test that the closing delimiter aligns; ASCII fallback remains available for non-UTF-8 locales.
- **Heavy vertical (`┃`):** part of Box Drawing, widely supported. Some fonts draw it slightly taller or shorter than Braille cells, so check for visible gaps.
- **Width calculation:** all glyphs used are single-width (East Asian Width: neutral/narrow). Do not use ambiguous-width characters.
- **Locale:** requires a UTF-8 locale. Fall back to ASCII (`#` and `-`) if not detected.
- **Accessibility:** the numeric readout stays alongside the bar so information is not conveyed by the graphic alone.

---

## 9. Input Data

The bar's precision is limited by its input. The renderer should receive raw token counts (`used`, `limit`), not a pre-rounded percentage.

**To confirm before implementation:** which fields the host status line mechanism actually provides for context usage, and whether they are raw counts or percentages. If only a rounded percentage is available, the 8-step-per-cell resolution is cosmetic only.

---

## 10. Testing and Acceptance Criteria

1. Every integer percent from 0 to 100 renders without misalignment; the closing `┃` sits in the same column on every line.
2. Adjacent percent values produce visibly different bars at the default width (2 steps per percent).
3. 0 tokens renders an empty track; 1 token renders at least one step; `used >= limit` renders a full bar.
4. Threshold colours switch at the configured boundaries, and attributes reset after the bar.
5. Renders correctly in iTerm2 with the user's current font; ASCII fallback works under `LANG=C`.
6. Bar plus readout never exceeds the available terminal width.

---

## 11. Implementation Notes

- The renderer is a pure function `(used, limit, width, theme) -> string`, so it can be unit-tested without a terminal.
- Language is open: a shell function is enough for a prototype, while a compiled binary (e.g. Rust) would suit a status line that runs on every refresh. Let each option justify itself on startup latency and maintainability.
- Tests should snapshot the 0-100% sweep at widths 10, 20 and 25.

---

## 12. Decisions

1. Only the Braille fill receives threshold colours; the whole-label red background is removed for this bar.
2. The empty track uses faint `⣀` dots.
3. The bar starts at 25 cells, shrinks to 10, then disappears to protect the numeric readout.
4. Use three configurable threshold colours, with no smooth gradient.
5. The existing code accepts raw `current_usage` counts and `context_window_size`, and the Context Bar already uses them. If a host payload supplies only `used_percentage`, retain that fallback with its inherent precision limit.

---

## 13. Appendix: Reference Sweep (1-20%, 25 cells)

```
Ctxt: ┃⡄⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  1%
Ctxt: ┃⡇⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  2%
Ctxt: ┃⣧⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  3%
Ctxt: ┃⣿⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  4%
Ctxt: ┃⣿⡄⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  5%
Ctxt: ┃⣿⡇⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  6%
Ctxt: ┃⣿⣧⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  7%
Ctxt: ┃⣿⣿⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  8%
Ctxt: ┃⣿⣿⡄⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃  9%
Ctxt: ┃⣿⣿⡇⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 10%
Ctxt: ┃⣿⣿⣧⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 11%
Ctxt: ┃⣿⣿⣿⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 12%
Ctxt: ┃⣿⣿⣿⡄⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 13%
Ctxt: ┃⣿⣿⣿⡇⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 14%
Ctxt: ┃⣿⣿⣿⣧⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 15%
Ctxt: ┃⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 16%
Ctxt: ┃⣿⣿⣿⣿⡄⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 17%
Ctxt: ┃⣿⣿⣿⣿⡇⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 18%
Ctxt: ┃⣿⣿⣿⣿⣧⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 19%
Ctxt: ┃⣿⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀┃ 20%
```
