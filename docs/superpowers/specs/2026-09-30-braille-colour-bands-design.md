# Braille context bar colour bands

## Intent

The Context Bar should retain earlier colours as usage rises: green fill, then adjacent amber fill, then adjacent red fill. Unused cells remain a neutral dotted track. The label and numeric readout keep their existing appearance.

## Behaviour

- Keep the stored default alert levels at 50% warning and 75% critical. Existing `brailleWarningAt`, `brailleCriticalAt`, and three colour overrides continue to work.
- Quantise each percentage boundary to the nearest whole displayed cell, with exact halfway values rounded down. On the default 25-cell rail the 50% and 75% boundaries display at 12 and 19 cells (48% and 76%). Do not round or rewrite saved settings.
- Colour the filled part of each cell according to its position. A partial cell receives the colour of that cell. The unfilled track and both delimiters retain their current colours.
- Apply the same rule to ASCII fallback and reduced rail widths. With colours disabled, emit no ANSI escapes.
- Preserve the existing slider modes and their alert behaviour.

## TUI setting

After the colour-band change is tested and committed, add an **Alert levels** editor to the Context Bar widget in the Items Editor. The editor shows the warning and critical percentages as stored, lets the user set each to a percentage from 0 to 100 (including decimals), and requires warning < critical. Escape cancels without saving; confirmation persists the widget metadata through the existing Items Editor update path. The editor does not change colours or display rounding.

## Verification

Exercise colour transitions at default and configured thresholds, partial cells, reduced width, ASCII fallback, and colour-off output. Exercise opening the editor, valid and invalid entries, cancel, and persistence. Run `bun test` and `bun run lint` before each implementation commit.
