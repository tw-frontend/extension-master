# Extension Design System

## Purpose

Every extension in this repository must feel like part of the same Telewebion
product family. This guide is the visual contract for extension popups and
options pages, regardless of whether an extension uses plain HTML/CSS or React.

The contract has two layers:

1. **Primitive tokens** preserve the supplied Telewebion palette.
2. **Semantic tokens** describe a UI role, so components do not depend on a raw
   color name.

Do not introduce a new brand or neutral color inside a component. If a missing
role is genuinely needed, add it here first and then use it consistently.

## Visual direction

- Telewebion red is the only brand accent.
- Interfaces are compact, calm, and content-led. Avoid gradients, decorative
  glow, heavy shadows, and excessive rounding.
- Neutral surfaces establish hierarchy; red indicates priority, selection,
  progress, and primary actions.
- Color never carries meaning alone. Pair it with a label, icon, shape, or
  status text.
- Extension-specific data colors are allowed only for charts with multiple
  series. They must not compete with the red brand action color.

## Primitive color tokens

The supplied `@red500` referenced an undefined `@red`. Until the canonical
value is confirmed, this system uses `#d93636` as the explicit working value
between `red400` and `red600`. Confirming the source value is an open design
system question; implementations must not silently choose another value.

```css
:root {
  /* Brand */
  --tw-red-300: #e15c5c;
  --tw-red-400: #de4747;
  --tw-red-500: #d93636;
  --tw-red-600: #c42e2e;
  --tw-red-700: #ae2929;

  /* Blue-tinted neutrals */
  --tw-neutral-100: #e4e7eb;
  --tw-neutral-200: #cbd2d9;
  --tw-neutral-400: #7b8794;
  --tw-neutral-700: #3e4c59;
  --tw-neutral-800: #1f2933;
  --tw-neutral-900: #10151a;

  /* True grays */
  --tw-gray-100: #e5e5e5;
  --tw-gray-200: #cccccc;
  --tw-gray-300: #b3b3b3;
  --tw-gray-400: #999999;
  --tw-gray-500: #808080;
  --tw-gray-600: #666666;
  --tw-gray-700: #4d4d4d;
  --tw-gray-800: #333333;
  --tw-gray-900: #1a1a1a;

  /* Dark overlays */
  --tw-dark-90: rgba(16, 21, 26, 0.9);
  --tw-dark-70: rgba(16, 21, 26, 0.7);
  --tw-dark-50: rgba(16, 21, 26, 0.5);
  --tw-dark-20: rgba(16, 21, 26, 0.2);
  --tw-dark-10: rgba(16, 21, 26, 0.1);
  --tw-dark-05: rgba(16, 21, 26, 0.05);

  /* Light overlays */
  --tw-light-90: rgba(255, 255, 255, 0.9);
  --tw-light-70: rgba(255, 255, 255, 0.7);
  --tw-light-50: rgba(255, 255, 255, 0.5);
  --tw-light-20: rgba(255, 255, 255, 0.2);
  --tw-light-10: rgba(255, 255, 255, 0.1);
  --tw-light-05: rgba(255, 255, 255, 0.05);
}
```

## Semantic color tokens

Components must consume these roles instead of primitive tokens.

| Role                     | Light theme  | Dark theme   | Use                         |
| ------------------------ | ------------ | ------------ | --------------------------- |
| `--color-canvas`         | `#ffffff`    | `neutral900` | Popup/page background       |
| `--color-surface`        | `#ffffff`    | `neutral800` | Cards, menus, controls      |
| `--color-surface-subtle` | `dark-05`    | `light-05`   | Quiet grouped regions       |
| `--color-text`           | `neutral900` | `neutral100` | Primary text                |
| `--color-text-muted`     | `neutral700` | `neutral200` | Secondary text              |
| `--color-text-subtle`    | `neutral400` | `neutral400` | Metadata and hints          |
| `--color-border`         | `neutral200` | `light-20`   | Default boundary            |
| `--color-brand`          | `red500`     | `red400`     | Accent, selected state      |
| `--color-action`         | `red600`     | `red500`     | Primary button background   |
| `--color-action-hover`   | `red700`     | `red400`     | Primary button hover        |
| `--color-danger`         | `red700`     | `red300`     | Destructive text and errors |
| `--color-focus`          | `red500`     | `red300`     | Focus ring                  |
| `--color-on-brand`       | `#ffffff`    | `#ffffff`    | Text/icons on red           |

Recommended implementation:

```css
:root {
  color-scheme: light;
  --color-canvas: #ffffff;
  --color-surface: #ffffff;
  --color-surface-subtle: var(--tw-dark-05);
  --color-text: var(--tw-neutral-900);
  --color-text-muted: var(--tw-neutral-700);
  --color-text-subtle: var(--tw-neutral-400);
  --color-border: var(--tw-neutral-200);
  --color-brand: var(--tw-red-500);
  --color-action: var(--tw-red-600);
  --color-action-hover: var(--tw-red-700);
  --color-danger: var(--tw-red-700);
  --color-focus: var(--tw-red-500);
  --color-on-brand: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --color-canvas: var(--tw-neutral-900);
    --color-surface: var(--tw-neutral-800);
    --color-surface-subtle: var(--tw-light-05);
    --color-text: var(--tw-neutral-100);
    --color-text-muted: var(--tw-neutral-200);
    --color-text-subtle: var(--tw-neutral-400);
    --color-border: var(--tw-light-20);
    --color-brand: var(--tw-red-400);
    --color-action: var(--tw-red-500);
    --color-action-hover: var(--tw-red-400);
    --color-danger: var(--tw-red-300);
    --color-focus: var(--tw-red-300);
  }
}
```

An extension may intentionally choose one fixed theme when its information
density benefits from it, but it must use the same semantic roles and palette.

## Typography

- Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
"Segoe UI", sans-serif`.
- Popup body: 13px minimum, 1.45 line height.
- Page title: 20–24px, weight 650–700, tight line height.
- Section title: 13–15px, weight 650–700.
- Labels and body copy: 11–13px. Do not use text below 10px.
- Code, keys, IDs, and numeric telemetry may use the system monospace stack.
- Use sentence case. Uppercase is reserved for short eyebrows and chart labels.

## Spacing and shape

Use a 4px spacing base: `4, 8, 12, 16, 20, 24, 32`.

- Popup outer padding: 16–20px.
- Card padding: 12–16px.
- Control height: at least 36px; icon-only controls are at least 36×36px.
- Touch targets should reach 44×44px when the layout permits.
- Small control radius: 6px; cards: 8px; prominent grouped panels: 12px.
- Use a 1px border for hierarchy. Shadows are reserved for floating menus.

## Component rules

### Header

Use one clear product title and an optional short eyebrow. Put at most one
utility action or status on the opposite side. Separate the header from content
with a border, not a large shadow.

### Buttons

- Primary: `color-action` with `color-on-brand`; one dominant action per view.
- Secondary: surface background with a default border.
- Ghost: transparent until hover; use for low-priority utility actions.
- Destructive: danger-colored text or outline; do not style ordinary errors as
  clickable destructive actions.
- Disabled buttons remain legible and show a non-interactive cursor.

### Inputs

Inputs use the surface background, default border, and a visible red focus ring.
Every control has a visible label. Error states combine red styling with a
specific text message and `aria-invalid` where applicable.

### Cards and sections

Cards group related information, not every row. Prefer dividers or spacing for
simple lists. A card may use a subtle red tint only for the primary result or
selected state.

### Tabs and segmented controls

Use buttons with `aria-pressed` or the appropriate tab pattern. The selected
item uses the action color and a visible text label; unselected items use a
neutral surface.

### Collapsible categories

Use native `details` and `summary` where possible. The summary must be keyboard
operable, retain a visible focus ring, and show a chevron whose direction
reflects the open state. Searching or filtering must reveal matching nested
content instead of hiding it inside a closed category.

### Status and progress

Status text uses `role="status"` for polite updates and `role="alert"` for
errors. Progress tracks are neutral; the active fill uses brand red. Never rely
on a red or gray dot without a text label.

## Motion

- Keep state transitions between 120–200ms.
- Animate opacity, color, or small transforms; avoid layout-heavy effects.
- Respect `prefers-reduced-motion: reduce` and remove non-essential animation.

## Accessibility baseline

- Normal text contrast is at least 4.5:1; large text and UI boundaries are at
  least 3:1.
- All actions are reachable by keyboard in logical order.
- Every interactive element has a visible focus state.
- Icon-only buttons have an accessible name.
- Heading levels describe the page structure without skipping levels.
- The interface remains usable at 200% zoom without horizontal clipping of
  essential actions.
- Do not remove native semantics to make styling easier.

## Extension implementation checklist

Before an extension is considered visually aligned:

- [ ] Primitive and semantic tokens are declared once at the stylesheet root.
- [ ] Components use semantic tokens; no one-off brand or neutral hex values.
- [ ] Primary actions and selected states use Telewebion red.
- [ ] Typography, spacing, borders, and radii follow this guide.
- [ ] Empty, loading, success, and error states are legible and announced.
- [ ] Keyboard focus, reduced motion, and contrast have been checked.
- [ ] The popup has been inspected at its declared width and at 200% zoom.
- [ ] Existing controls, labels, and data states remain available after restyling.

## Open design-system question

- Confirm the canonical hex value behind the original `@red` alias used by
  `@red500`. Replace `#d93636` everywhere only after that source value is known.
