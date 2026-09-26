# Focal V3 Design System

The implementation follows NEW_DES.md. Scope is Login and every component rendered
inside V3, not the separate public, legacy, V4, or V5 experiences. The source
baseline inventory is in .design-qa/component-map.json; the final inventory is
.design-qa/component-map-after.json, including the new Login scene.

## Applied MengTo Skills

- design-first-ui-prompting: inventory and operational hierarchy before styling.
- operational-enterprise-ai: product-first controls, real data, restrained status.
- build-awwwards-quality-sites: deliberate composition and visual inspection,
  adapted to an enterprise workbench without marketing sections or scroll effects.
- no-ai-design-slop: removed decorative numbering, oversized framing, tinted
  navigation, nested cards, redundant feature copy, and repeated entrance effects.
- animation-systems and optimize-web-animations: shared state feedback, bounded
  transitions, visibility-aware loaders, lifecycle cleanup, reduced-motion tests.
- threejs: lazy Login-only renderer, instanced geometry, limited pixel ratio,
  static fallback, context-loss handling, explicit resource disposal.
- iterate-until-verified: build, focused unit tests, route matrix, screenshots,
  and real authentication checks with limitations recorded separately.
- GSAP was inspected; native CSS and WAAPI meet the small motion scope without
  introducing an additional scheduler or dependency.

## Visual Language

White work surfaces on #F4F5F7, fine #DCE1E6 separators, #20262C primary text,
and #626D78 secondary text. Brand blue is #0098FF; filled controls use the darker
#006FBE for readable white labels. Emerald #004225 is selective, not a page tint.
Gold #FFD700 is reserved rather than spread across navigation or status.

Segoe UI with system fallbacks, 14px body, 13px dense controls/tables, 600-weight
headings and labels. Sentence-case labels, zero letter spacing, no viewport-based
font scaling. Application headings stay compact; Login has a 26px form heading.

The expanded rail is 232px, collapsed rail 64px, and desktop topbar 56px.
Standard controls are 36px; Login fields are 40px. Workspaces use 20px desktop
padding and 12px mobile padding. Repeated framed items have 6px corners; page
sections remain unframed or divided by rules. Tables scroll within their own
regions, not the document. Responsive secondary panels remain accessible below
the main work area instead of disappearing.

## Source Ownership

- tokens.css: semantic color, type, space, dimension, motion, and elevation tokens.
- v3-components.css and v3-components-responsive.css: scoped cross-route controls,
  tables, forms, notices, dialogs, tool layouts, and responsive behavior.
- src/app/components/v3-shell: navigation, context controls, profile dialog,
  keyboard focus, collapsed persistence, and bounded route feedback.
- src/app/components/login: authentication layout and optional 3D enhancement.
- src/app/directives/visible-motion.ts: dynamic loader visibility and cleanup.
- Route-owned CSS retains workflow-specific layout, with the shared V3 layer
  providing the common visual contract. Backend contracts and RBAC are unchanged.

## Interaction And Motion

Immediate input and navigation; no artificial login wait. Native controls preserve
existing model bindings. Icon-only controls retain accessible names and titles.
The sidebar supports mobile dismissal; profile dialog traps Tab and restores focus
on Escape. A skip link reaches the main workspace.

Micro feedback uses 160ms; small UI transitions use 180-240ms. Route entry is a
short opacity change, not a translated or blurred page. Loading is tied to actual
requests. Shared loader animation pauses offscreen or when the document is hidden.
Reduced motion removes transitions and movement, not merely their duration.

The Login scene uses nine connected instanced surfaces and one line batch. It has
two draw calls, a 1.5 DPR cap, no textures, shadows, post-processing, or continuous
ambient loop. Pointer response settles, then stops RAF. Resize, intersection,
document visibility, reduced motion, context loss, and destruction are handled.
All geometry, materials, renderer resources, listeners, and observers are released.
WebGL failure leaves the form, identity, and supporting text immediately usable.

## Verification

Run from frontend:

```powershell
npm.cmd run build
npm.cmd test -- --watch=false --ts-config=tsconfig.design-spec.json --include=src/app/components/login/login.spec.ts
node .hallmark/verify-v3-routes.cjs
node scripts/verify-redesign.cjs
node scripts/verify-editor-layouts.cjs
node scripts/verify-adherence-layout.cjs
node scripts/redesign-audit.cjs --inventory-only
```

The existing production preview at http://localhost:4200 serves the built app and
proxies the backend on port 8080. A fresh build is needed to update this preview.

Evidence:
- .design-qa/before-login.png and before-home.png: captured baseline.
- .design-qa/component-map.json: component and animation inventory.
- .hallmark/v3-route-report.json: 39 surfaces across seven viewport sizes.
- .hallmark/screenshots/v3-routes: routed desktop screenshots.
- .design-qa/interaction-report.json: authentication timing, animation samples,
  canvas pixel variation, reduced motion, navigation, modal focus, repeated route
  cleanup, and WebGL fallback checks.
- .design-qa/editor-layout-report.json: a real article editor, Academy field
  containment, compact course headers, and non-overlapping graph auto layout.
- .design-qa/adherence-layout-report.json: compact error-state layout at all seven
  viewport sizes, without changing the protected endpoint's access response.
- .design-qa/*-desktop.png, *-mobile.png, profile-dialog.png: focused visual checks.

The route matrix covers Login plus 38 V3 URLs at 390, 768, 1280, 1366, 1440,
1536, and 1920px widths. Its client-only ADMIN role setting exposes restricted
layouts for visual inspection; it does not grant backend authorization. Protected
API responses may therefore be denied. The focused interaction test authenticates
the actual AGENT test account without replacing its token or role. Privileged
admin operations are not claimed as end-to-end verified.

The full existing test suite is blocked by unrelated service specs: kb.spec.ts
imports nonexistent Kb, and page.spec.ts treats the Page interface as an injectable
value. The isolated Login suite contains four regression tests. Production build
still reports existing initial-bundle and component-CSS budget warnings; budgets
have not been raised to hide them. No configured lint script exists.

## Final Measurements

Final route sweep completed on 2026-09-07 local time: 39 surfaces across seven
viewports, 273 checks, zero layout failures, and zero reported JavaScript errors.
The four focused Login unit tests passed. The real-login interaction suite,
seven editor-layout checks, and seven Adherence error-layout checks also passed.
Full-suite and privileged-workflow limitations above still apply.

Production build: 509.05 KB initial raw, 126.32 KB estimated transfer. The initial
bundle remains 9.05 KB above its 500 KB warning budget. Three.js is a separate
531.31 KB lazy chunk (110.78 KB estimated transfer), not a startup dependency.
Calendar and its shared icon dependencies are now lazy-loaded with the original
route guard and feature metadata retained.

The real-login interaction run completed authentication in 266 ms. Both desktop
and mobile scene captures contained visible geometry; the renderer used two draw
calls and stopped when settled. Reduced motion, synthetic document visibility,
offscreen loaders, context loss, and disabled WebGL were exercised. Three repeated
sign-in cycles retained zero workspace canvases and stable DOM counts. Forced-GC
workspace heaps were 9.35, 9.69, and 9.96 MB: bounded growth in this short sample,
not a claim of exhaustive leak freedom or performance on every device.

The editor supplement exercised existing article #33 at 1366 and 390px without
saving content. Course headers measured 96px desktop and 215px mobile. Graph auto
layout had zero node overlaps and 24px square connection controls; it was not
saved. The underlying sample course contains literal escaped newlines; its
authored content was preserved rather than rewritten as part of the redesign.

On machines with limited free disk space, the route harness accepts a single
viewport, for example `node .hallmark/verify-v3-routes.cjs --viewport=tablet-768`.
Run mobile-390, tablet-768, laptop-1280, desktop, desktop-1440, desktop-1536, and
desktop-1920 separately, then `node scripts/merge-viewport-reports.cjs`. The merger
requires all 273 results with zero failures; it does not treat interrupted runs
as passes. Browser disk caches are bounded and each viewport uses a fresh process.
