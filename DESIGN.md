---
version: 1
name: NEON-17
description: >
  Cyberpunk horror UI for "НЕОН-17", a co-op first-person escape room set in a flooding,
  abandoned neon metro. Structure follows the discipline of the dark dev-tool systems in the
  awesome-design-md library (strict token ladder, one CTA hierarchy, hairline surfaces); colours,
  type and mood are the game's own: near-black wet concrete, cyan signal light, hot-pink warning
  neon, acid-yellow hazard paint. No violet anywhere.

colors:
  bg: "#06070a"            # page / void
  surface: "#0c0f15"       # panels
  surface-2: "#121722"     # raised panels, inputs
  line: "#1d2431"          # hairlines
  line-strong: "#2b3546"
  ink: "#e6f1f4"           # primary text
  ink-muted: "#8693a3"     # secondary text
  ink-faint: "#4c5767"
  cyan: "#22f0ff"          # primary action, signal, own player
  pink: "#ff2e88"          # danger, enemy AI voice, destructive actions
  acid: "#e6ff3a"          # hazard, objectives, timers
  amber: "#ff9a1f"         # warnings
  ok: "#3dff8a"            # ready / success
  water: "#0f6f7a"

typography:
  display: "Unbounded, system-ui, sans-serif"   # 600, uppercase, letter-spacing .04em
  mono: "JetBrains Mono, ui-monospace, monospace" # all UI copy, HUD, numbers (tabular)
  scale: [12, 14, 16, 20, 28, 44, 72]          # px; HUD body 14, panels 16, titles 28/44, hero 72
  line-height: { tight: 1.05, ui: 1.4, body: 1.6 }

rounded: { none: 0, xs: 2px, sm: 4px }         # sharp; panels use a 12px clipped corner instead of radius
spacing: [4, 8, 12, 16, 24, 32, 48, 64]
elevation:
  glow-cyan: "0 0 0 1px #22f0ff55, 0 0 24px #22f0ff33"
  glow-pink: "0 0 0 1px #ff2e8855, 0 0 24px #ff2e8833"
motion:
  fast: 120ms
  base: 200ms
  ease: "cubic-bezier(.2,.8,.2,1)"
---

## Rules

- **One action colour.** Cyan is the only primary button. Pink only for danger/destructive and
  the rogue AI ("ДИСПЕТЧЕР"). Acid is for objectives, timers and hazard stripes, never a button fill.
- **Panels** are `surface` with a 1px `line` border and one clipped top-right corner
  (`clip-path`), never rounded cards, never nested more than two deep.
- **Type**: Unbounded uppercase only for titles and the logo; everything else JetBrains Mono.
  Numbers (timer, codes, counts) use tabular figures.
- **Buttons**: 44px min height, uppercase mono 14/700, letter-spacing .08em. Hover: border glows and
  the fill steps 1 shade up; press: translateY(1px). Focus: 2px cyan outline offset 2px.
- **Inputs**: `surface-2`, 1px `line-strong`, cyan border on focus, visible label above.
- **HUD** lives on the edges (objectives top-left, timer top-centre, AI feed bottom-left, chat
  bottom-right), never covers the crosshair column. Text on the 3D view gets a 60% black backing.
- **Motion**: glitch/flicker only for story moments (AI messages, events). UI chrome stays calm.
  Respect `prefers-reduced-motion`: no flicker, no shake.
- **Contrast**: body text ≥ 4.5:1 on its surface; muted text only for secondary info.
