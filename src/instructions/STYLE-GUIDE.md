# STYLE-GUIDE

The main stylesheet is main.css
All fields, inputs, buttons should be defined globaly in the main.css

## Visual direction

Minimal, readable, subtle elevation. Use very simple fonts. if using colors they should be pastell. 

Use this website as an example:
https://blokas.io/store/

## Tokens (defined in `styles/main.css`)

- Colors: `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-brand`.
- Radii: `--radius-sm`, `--radius`, `--radius-lg`
- Shadows: `--shadow-sm`, `--shadow-lg`
- Spacing: `--space-1 .. --space-7`

## Rules

- Buttons and inputs use tokens only (no inline magic numbers).
- Focus visible rings on all interactive controls.
- Class naming: `component-name-element-modifier` (kebab-case).

## Inspiration

...
