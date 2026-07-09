---
name: Organic Vitality
colors:
  surface: "#fbfaee"
  surface-dim: "#dbdbcf"
  surface-bright: "#fbfaee"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f5f4e8"
  surface-container: "#efeee3"
  surface-container-high: "#e9e9dd"
  surface-container-highest: "#e4e3d7"
  on-surface: "#1b1c15"
  on-surface-variant: "#3c4a42"
  inverse-surface: "#303129"
  inverse-on-surface: "#f2f1e5"
  outline: "#6c7a71"
  outline-variant: "#bbcabf"
  surface-tint: "#006c49"
  primary: "#006c49"
  on-primary: "#ffffff"
  primary-container: "#10b981"
  on-primary-container: "#00422b"
  inverse-primary: "#4edea3"
  secondary: "#795900"
  on-secondary: "#ffffff"
  secondary-container: "#ffc329"
  on-secondary-container: "#6f5100"
  tertiary: "#446900"
  on-tertiary: "#ffffff"
  tertiary-container: "#78b300"
  on-tertiary-container: "#283f00"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#6ffbbe"
  primary-fixed-dim: "#4edea3"
  on-primary-fixed: "#002113"
  on-primary-fixed-variant: "#005236"
  secondary-fixed: "#ffdf9f"
  secondary-fixed-dim: "#f9bd22"
  on-secondary-fixed: "#261a00"
  on-secondary-fixed-variant: "#5c4300"
  tertiary-fixed: "#b2f746"
  tertiary-fixed-dim: "#98da27"
  on-tertiary-fixed: "#121f00"
  on-tertiary-fixed-variant: "#334f00"
  background: "#fbfaee"
  on-background: "#1b1c15"
  surface-variant: "#e4e3d7"
typography:
  # Display fonts use Plus Jakarta Sans (heavier, more architectural)
  # Body & UI use Lexend (legibility-tuned for outdoor reading)
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: "800"
    lineHeight: "1.2"
    letterSpacing: -0.02em
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: "700"
    lineHeight: "1.2"
  h3:
    fontFamily: Lexend
    fontSize: 24px
    fontWeight: "600"
    lineHeight: "1.3"
  body-lg:
    fontFamily: Lexend
    fontSize: 18px
    fontWeight: "400"
    lineHeight: "1.6"
  body-md:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: "400"
    lineHeight: "1.6"
  label-caps:
    fontFamily: Lexend
    fontSize: 12px
    fontWeight: "700"
    lineHeight: "1"
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-padding: 48px
---

## Brand & Style

The design system is built on the philosophy of "Technological Stewardship"—bridging the gap between high-tech agricultural data and the tactile, rhythmic nature of farming. The style blends **Glassmorphism** with **Modern Organic** principles to ensure the interface feels advanced yet deeply rooted in the earth.

The aesthetic avoids the "clinical" look of traditional SaaS, opting instead for warmth and energy. Key visual drivers include:

- **Lush Vitality:** High-saturation botanical tones.
- **Soft Depth:** Layered surfaces with colorful ambient glows rather than gray shadows.
- **Professional Warmth:** A welcoming, human-centric approach to complex data visualization.

## Colors

The palette is anchored by **Emerald Lush**, a high-energy green that represents growth and health. This is complemented by **Leaf Lime** for interactive success states and **Sun Yellow** for warnings and high-visibility alerts.

The foundation of the UI is **Earth Cream**, a soft, warm neutral that eliminates eye strain and reinforces the organic narrative. Deep **Soil Text** provides high-contrast legibility without the harshness of pure black. Gradients should transition from Emerald to Forest for headers, or Sun to Lime for "active growth" indicators.

## Typography

This design system uses a **dual-font pairing** for clear hierarchy:

- **Plus Jakarta Sans** — display font for page titles (`h1`, `h2`) and brand moments. Its taller x-height and tighter geometry give marketing-grade impact and signal "this is the header you should land on." Loaded via `--font-jakarta` and exposed as Tailwind utility `font-display`.
- **Lexend** — primary UI and body font for everything else (`h3` and below, paragraphs, labels, inputs, navigation, data tables). Designed specifically to reduce visual stress and improve reading proficiency, Lexend's expanded character widths and geometric clarity align perfectly with a professional agritech tool used in outdoor lighting. Loaded via `--font-lexend` and is the default `font-sans`.

Both fonts are loaded via `next/font/google` in `src/app/layout.tsx`. Use `font-display` only for `h1`/`h2` (with `font-extrabold` or `font-bold`); never mix Jakarta into long-form body copy. Headlines use a tighter letter-spacing and heavier weights to feel impactful and modern. Body text maintains a generous line height to ensure clarity when viewing complex farming metrics in outdoor lighting conditions.

## Layout & Spacing

The system employs a **Fluid Grid** model with a 12-column structure for desktop and a 4-column structure for mobile. Rhythm is dictated by an 8px base unit.

To reinforce the "Organic" feel, the layout avoids overcrowding. Use generous whitespace (negative space) around data visualizations. Content cards should utilize dynamic padding, ensuring that the "breathability" of the app mimics the openness of a field.

## Elevation & Depth

Depth is achieved through **Glassmorphism** and **Tinted Ambient Shadows**.

1. **Glass Layers:** Use 60-80% opacity on Earth Cream surfaces with a 20px background blur for headers and floating navigation bars.
2. **Shadows:** Avoid gray/black shadows for decorative card elevation. Use a low-opacity Emerald (#10B981 at 15%) or Sun Yellow (#FBBF24 at 10%) shadow for primary cards to create a "glowing" effect that feels alive. **Exception — Neumorphic Depth:** Neumorphic elements (raised/inset surfaces, pressed buttons, recessed inputs) may use neutral `rgba(143,139,120)` shadows paired with white `rgba(255,255,255)` highlights for structural depth. These shadows are functional (simulating light direction), not decorative, and do not violate the "no gray shadows" rule.
3. **Inner Glow:** Use a subtle 1px white inner-border on glass elements to simulate the edge of a water droplet or greenhouse glass.

### Neumorphic Shadow Utilities (CSS Classes)

The project provides a set of pre-built CSS classes in `globals.css` to avoid scattering inline `shadow-[]` values across components. Always prefer these classes over raw `rgba(143,139,120)` inline shadows.

| Class | Use Case | Visual |
|---|---|---|
| `neu-raised` | Default card/container elevation | Raised 8px soft |
| `neu-raised-hover` | Add to `neu-raised` for hover lift | Increases to 12px |
| `neu-raised-sm` | Compact elements (mobile cards, pills) | Subtle 3px |
| `neu-raised-lg` | Hero cards, modal backdrops | Bold 10px |
| `neu-inset` | Recessed surfaces (table wells, pill tracks) | Inset 3px |
| `neu-inset-deep` | Action buttons, toggle wells, icon slots | Inset 5px |
| `neu-inset-shallow` | Form inputs, filter controls | Inset 3px, softer |
| `neu-header` | Sticky page headers | Drop shadow only |
| `neu-card-press` | Feature cards (raised → inset on hover) | Transition to inset |
| `neu-icon-well` | Icon containers within cards | Inset 4px, white highlight |
| `neu-btn-auth` | Auth page CTA buttons | Raised + active press |
| `neu-btn-auth-secondary` | Google/social login buttons | Softer raised |
| `neu-input-auth` | Auth page input fields | Inset 6px |
| `neu-btn-primary` | Primary dashboard buttons | Emerald inset + press |
| `neu-dropdown` | Floating menus, select panels | Bold 10px drop |
| `neu-input-green` | Auth page inputs (green tinted) | Inset 4px, emerald hue |
| `neu-btn-green` | Auth page green CTA buttons | Raised emerald + active press |
| `neu-btn-green-secondary` | Auth page secondary/social buttons | Softer emerald raised |
| `neu-modal` | Modal/dialog containers | Reverse inset (white first) |
| `neu-badge-inset` | Status chips, quality tags | Inset 2px, balanced |
| `neu-badge-inset-light` | Lighter status tags | Inset 2px, softer |
| `neu-progress-track` | Progress bar wells | Single-sided inset 2px |
| `neu-device-hover` | List item hover (IoT devices) | Subtle inset on `:hover` |
| `neu-btn-danger` | Emergency stop, destructive actions | Red-tinted deep inset |
| `neu-btn-resume` | Resume/CTA buttons (green raised) | Emerald raised with glow |
| `neu-icon-raise` | Icon hover (raised on `group:hover`) | 4px raised on hover |
| `neu-icon-raise-lg` | Feature card icon hover (larger raise) | 6px raised on hover |
| `neu-seg-active` | Active tab/segment button | 3px raised |
| `neu-seg-idle` | Idle tab/segment hover | 2px raised on `:hover` |
| `neu-dropdown-selected` | Selected dropdown item | Inset 3px well |
| `neu-dropdown-press` | Dropdown item press | Inset 3px on `:active` |
| `neu-hero-circle` | Branded hero circle (mobile) | Deep emerald 10px |
| `neu-hero-circle-sm` | Branded hero circle (desktop) | Softer emerald 10px |
| `neu-progress-inset` | Sensor chart progress tracks | Inset 2px, rounded |
| `neu-selector-press` | Dropdown selector press state | Inset 4px on `:active` |
| `neu-icon-selected` | Selected dropdown icon | 3px raised |
| `neu-stepper-press` | Stepper +/- button press | Inset 5px on `:active` |
| `neu-slider-track` | Range slider track well | Deep inset 6px |

## Shapes

The shape language is defined by "Generous Curvature." Sharp corners are strictly avoided to maintain a friendly, approachable persona.

- **Standard Cards/Buttons:** 16px (1rem) corner radius.
- **Large Sections:** 24px (1.5rem) corner radius.
- **Interactive Toggles/Pills:** Fully rounded (capsule style).
  This extreme roundness mimics organic forms like seeds, leaves, and smooth river stones.

## Components

### Buttons

Primary buttons use a vibrant Emerald-to-Forest linear gradient with a slight lift on hover. Text is white for maximum contrast. Secondary buttons use a Sun Yellow outline or a solid Leaf Lime background for lower-priority actions.

### Cards

Cards are the primary container. They feature a soft 1px border in a slightly darker cream tint and a subtle colorful shadow. Header cards for weather or soil health data utilize a glassmorphic background to allow the brand colors to peek through from behind.

### Input Fields

Inputs use the Earth Cream background but with a slightly recessed "Neomorphic" inner shadow to indicate interactability. On focus, the border glows with a 2px Emerald stroke.

### Specialized Ag-Components

- **Crop Health Indicators:** Circular gauges with Sun-to-Emerald gradients indicating growth progress.
- **Sensor Nodes:** Small, high-roundness chips that use Leaf Lime for "Active" and Sun Yellow for "Attention Needed."
- **Data Graphs:** Smooth splines (not jagged lines) with soft color-fill gradients underneath the curves to represent moisture and nutrient levels.
