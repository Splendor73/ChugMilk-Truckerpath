# NavPro UI Extraction

Reference captured from the authenticated `https://navpro.truckerpath.com/map/index` desktop app on April 18, 2026.

This repo is still docs-only, so the extraction is packaged as design tokens plus a reusable shell CSS file:

- Theme file: [navpro-theme.css](/Users/yashupatel/Documents/YGP_Project/trucker-track/ChugMilk-Truckerpath/docs/ui/navpro-theme.css)
- Source viewport used for inspection: `1440x1000`

## Layout Shell

- Top header: `56px` tall, white background, subtle bottom border.
- Left icon rail: `72px` wide, `#F9FAFB` background.
- Main control panel: `440px` wide, white background, right shadow `12px 0 12px -12px rgba(0,0,0,.25)`.
- Map canvas: fills remaining width and uses floating white controls with a soft drop shadow.

Recommended grid for the prototype:

```css
grid-template-columns: 72px 440px 1fr;
grid-template-rows: 56px 1fr;
```

## Core Tokens

### Typography

- Font stack: `"Open Sans", system-ui, "Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif`
- App base: `14px`
- Small labels: `12px`
- Primary nav/tab weight: `600`
- Trip id emphasis: `700`

### Color

- Main surface: `#FFFFFF`
- Rail background: `#F9FAFB`
- Soft input background: `#F5F7FA`
- Primary blue: `#4066D4`
- Muted blue-gray: `#59698C`
- Inactive tab gray: `#7F8596`
- Soft border: `#E7EBF3`
- Input border: `#B4BAC8`
- Badge background: `#CDD0D8`
- Badge text: `#4C556C`
- Base body text: `rgba(0, 0, 0, 0.85)`

### Radius + Shadow

- Input radius: `6px`
- Floating control radius: `4px`
- Status pill radius: `3px`
- Panel shadow: `12px 0 12px -12px rgba(0, 0, 0, 0.25)`
- Floating control shadow: `0 2px 5px rgba(0, 0, 0, 0.25)`

## Extracted UI Elements

### Header

- White app bar with product logo at left.
- Primary nav uses medium-weight text with icon + label.
- Active item color is `#4066D4` with a blue underline.
- Inactive items use `#59698C`.

### Left Rail

- Very light gray background.
- Monochrome line icons in a centered vertical stack.
- Separate from the panel with a thin border rather than a heavy shadow.

### Panel Tabs

- First row is a two-tab switcher: `Search Locations` and `Find Drivers`.
- Tabs are centered, `14px` semibold, with `16px 0 8px` padding.
- Active state is blue text plus blue bottom rule.
- Inactive state is gray text.

### Routing Profile Block

- Label treatment uses `12px` semibold muted text.
- KPI row is a five-column strip for length, height, weight, axles, trailers.
- The row uses small labels over `14px` semibold values.

### Search Input

- Height: `40px`
- Background: `#F5F7FA`
- Border: `1px solid #B4BAC8`
- Radius: `6px`
- Padding: `0 15px 0 36px`
- Placeholder tone is lighter than body text.

### History Tabs

- `Recent Trips`, `Saved Routes`, `Shared Trips`
- Same active/inactive visual system as the upper tabs.
- Container has `16px 16px 0` padding.

### Trip List

- White list rows with thin separators.
- Trip id line is the strongest text in the card.
- Status pill is compact, `22px` tall, gray-filled, `12px` semibold.
- Secondary metadata drops to `12px` and muted gray.

### Floating Map Controls

- White surface with `4px` radius.
- Stronger shadow than the panel edge.
- Label uses `14px` semibold black text.
- `Map Layer` control measured at `121x38`.

## Safe Reproduction Rules

- Match the shell proportions first: `56 / 72 / 440`.
- Keep the UI bright and flat; most depth comes from the panel edge shadow and floating controls only.
- Use blue only for selected state, links, and key navigation emphasis.
- Keep forms dense and compact; NavPro does not use oversized inputs or cards.
- Prefer thin borders and separators over filled panels.

## Next Build Step

If you turn this into a real frontend, start by importing `navpro-theme.css` and build these primitives in order:

1. `navpro-topbar`
2. `navpro-rail`
3. `navpro-panel`
4. `navpro-panel-tabs`
5. `navpro-search`
6. `navpro-trip-list`
7. `navpro-float-control`
