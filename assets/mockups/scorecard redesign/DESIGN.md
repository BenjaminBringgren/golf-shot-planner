---
name: Performance Scorecard System
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#45474c'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#75777d'
  outline-variant: '#c5c6cc'
  surface-tint: '#565f70'
  primary: '#040d1b'
  on-primary: '#ffffff'
  primary-container: '#1a2332'
  on-primary-container: '#818a9d'
  inverse-primary: '#bec7db'
  secondary: '#2c694e'
  on-secondary: '#ffffff'
  secondary-container: '#aeeecb'
  on-secondary-container: '#316e52'
  tertiary: '#240002'
  on-tertiary: '#ffffff'
  tertiary-container: '#4e0008'
  on-tertiary-container: '#e95a59'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae3f7'
  primary-fixed-dim: '#bec7db'
  on-primary-fixed: '#131c2a'
  on-primary-fixed-variant: '#3e4758'
  secondary-fixed: '#b1f0ce'
  secondary-fixed-dim: '#95d4b3'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#0e5138'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#8d141e'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  h1:
    fontFamily: Lexend
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  h2:
    fontFamily: Lexend
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Lexend
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Lexend
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  score-display:
    fontFamily: Lexend
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-xs: 4px
  space-sm: 8px
  space-md: 16px
  space-lg: 24px
  row-height: 56px
  container-padding: 12px
---

## Brand & Style

The design system is engineered for the modern athlete who values precision, clarity, and a premium sporting experience. It moves away from the utilitarian aesthetic of traditional paper scorecards toward a sophisticated, "app-first" interface that feels both high-tech and approachable.

The style is **Modern Corporate** with a heavy influence from **Minimalism**. It prioritizes data legibility and effortless navigation during active play. By using ample whitespace and a refined color palette, the system evokes a sense of calm and focus, reflecting the mental discipline required on the golf course. The overall mood is professional, reliable, and premium.

## Colors

The palette is anchored by a sophisticated deep navy, which replaces traditional black to provide high contrast without harshness. This primary navy is used for the "hero" column (hole numbers) and critical text, establishing a strong structural anchor.

*   **Primary (Deep Navy):** Used for structural elements, hole identifiers, and primary navigation.
*   **Secondary (Fairway Green):** Reserved for positive indicators, such as birdies, under-par totals, and successful GIR (Green in Regulation).
*   **Tertiary (Warning Red):** Used sparingly for over-par scores and negative performance indicators.
*   **Neutrals:** A range of clean whites and cool, soft grays (`#F8F9FA` to `#E2E8F0`) creates the "app-like" layers, separating rows and sections without the need for heavy borders.

## Typography

This design system utilizes **Lexend** across all levels. Chosen for its exceptional readability and athletic character, Lexend’s expanded character width reduces visual crowding in tabular layouts.

Data-heavy views utilize `label-caps` for column headers to create a clear distinction between metadata and the actual score. The `score-display` level is optimized for the numerical values within the scorecard, ensuring the player's performance is the most prominent element on the screen. Medium and Semi-Bold weights are preferred over regular weights to maintain legibility in bright, outdoor lighting conditions.

## Layout & Spacing

The layout follows a fluid, mobile-first approach designed for one-handed use on the course. To avoid the cramped "spreadsheet" feel, the system uses a generous `row-height` of 56px, allowing for large tap targets and vertical breathing room.

Horizontal margins are kept tight (`container-padding: 12px`) to maximize the width available for data columns on small devices. Vertical rhythm is established through an 8px grid system. Instead of traditional table lines, the layout uses subtle background tints on alternating rows or groupings (like the Front 9 vs Back 9) to guide the eye horizontally.

## Elevation & Depth

Visual hierarchy is achieved through **tonal layers** and **ambient shadows**. The main scorecard is treated as a primary surface floating slightly above a soft gray background.

*   **Base Layer:** Light gray (`#F1F5F9`) background.
*   **Card Layer:** White (`#FFFFFF`) with a very soft, diffused shadow (10% opacity navy tint) to create a distinct "app" feel.
*   **Active States:** When a hole or score is selected for entry, a subtle inner-glow or a slightly deeper shadow is applied to the specific cell to indicate focus.
*   **Fixed Headers:** The top navigation and bottom "Total" bars use a high-elevation shadow to remain visible while the player scrolls through the round.

## Shapes

The design system employs a consistent **Rounded** language (Base: 0.5rem) to soften the interface and make it feel more modern and tactile.

*   **Main Containers:** Use `rounded-xl` (1.5rem) for the primary scorecard card to differentiate it from the phone's screen edges.
*   **Score Badges:** Birdies and Bogeys are enclosed in circles or highly rounded squares.
*   **Navy Column:** The leading "Hole Number" column uses a specific rounding strategy where only the left-hand corners are rounded, or it is treated as a floating pill-shape within the row to maintain the spacious aesthetic.

## Components

### Score Badges
Scores are highlighted using geometric shapes. A circle represents a Birdie (Primary Green), while a square with `rounded-sm` corners represents a Bogey (Tertiary Red). "Par" scores remain unadorned for clean visual scanning.

### Scorecard Rows
Rows are interactive components. On tap, they should expand slightly or provide a haptic response. The "Hole Number" cell is the primary anchor, styled in the Deep Navy accent color with white text.

### Inputs
Numeric inputs for score entry should be large, center-aligned, and use the `score-display` typography. They should appear in a modal or an expanded row state to ensure the player can easily tap the correct number while moving between holes.

### Summary Bar
A sticky bottom component that tracks the current "Total" and "+/-" relative to par. It uses a soft blur background (glassmorphism) or a solid white background with a prominent top shadow to stay separated from the scrolling list.

### Progress Chips
Small, subtle chips at the top of the view to show "Holes Completed" or "Current Thru," using a light gray background with navy text.