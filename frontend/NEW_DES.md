# Focal V3 — COMPLETE ENTERPRISE UI / UX / MOTION REDESIGN

You are acting as a combined:

* Principal Product Designer
* Staff Frontend Engineer
* Design Systems Architect
* Motion Designer
* WebGL / Three.js Engineer
* Accessibility Engineer
* Frontend Performance Engineer

Your task is to perform a **complete production-grade visual and motion redesign of Focal V3**.

This is NOT a landing-page redesign.

Focal is an enterprise operational application intended to feel credible enough to be deployed inside organizations with the product quality expectations of companies such as Apple, Microsoft, Stripe, Citi, Revolut, Salesforce, ServiceNow, Atlassian, Linear, and modern institutional banking platforms.

Do NOT copy any of those companies.

Instead, extract their common qualities:

* precision
* restraint
* clarity
* extremely consistent spacing
* strong information hierarchy
* excellent typography
* polished interaction
* dense but readable enterprise layouts
* confidence
* reliability
* subtle premium motion
* excellent accessibility
* very high perceived engineering quality

The final interface should communicate:

> "This is a serious operational system people can work in for eight hours per day."

---

# 1. USE THE MENGTO SKILLS REPOSITORY

The repository is available from:

https://github.com/MengTo/Skills

Before implementing the redesign, inspect the repository and load the relevant `SKILL.md` files.

At minimum, inspect and apply principles from:

* `agent-skills/ui/design-first-ui-prompting/SKILL.md`
* `agent-skills/web-design/threejs/SKILL.md`
* `agent-skills/codex/optimize-web-animations/SKILL.md`
* `agent-skills/web-design/build-awwwards-quality-sites/SKILL.md`
* `agent-skills/web-design/operational-enterprise-ai/SKILL.md`

Also search the Skills repository for relevant skills covering:

* animation systems
* GSAP
* micro-interactions
* enterprise UI
* layout systems
* typography
* progressive blur
* borders
* shadows
* WebGL backgrounds
* responsive design
* interaction states

Use only skills that actually improve this application.

Do NOT blindly combine every visual style in the Skills repository.

The final design needs ONE coherent visual language.

---

# 2. FIRST AUDIT THE APPLICATION

DO NOT immediately start rewriting CSS.

First inspect the repository.

Identify:

1. the V3 Shell component
2. every component directly rendered by V3 Shell
3. every nested component visually participating in V3 Shell
4. sidebar/navigation components
5. top navigation/header components
6. search / command controls
7. cards
8. dashboard widgets
9. dropdowns
10. profile/user controls
11. notification components
12. buttons
13. inputs
14. dialogs
15. menus
16. tables
17. badges/status pills
18. empty states
19. loaders/skeletons
20. tooltips
21. overlays
22. any shared components visible inside the V3 Shell
23. the complete Login page and everything it renders
24. existing animations
25. CSS keyframes
26. Angular animations
27. GSAP or other animation libraries if present
28. WebGL/canvas usage if present
29. shared design tokens
30. global typography/spacing rules affecting these pages

Build a dependency/component map internally before editing.

The scope is:

## MUST REDESIGN

* V3 Shell
* ALL components used visually by V3 Shell
* Login page
* ALL components used visually by Login

Do not redesign unrelated legacy modules unless a shared component requires a safe global change.

---

# 3. PRESERVE APPLICATION BEHAVIOR

This is a visual, UX, layout and motion modernization.

DO NOT break:

* routing
* authentication
* authorization
* RBAC
* API calls
* forms
* validators
* state management
* observables
* signals
* services
* WebSockets
* business logic
* backend contracts
* event handlers
* component outputs
* component inputs
* existing functional workflows

Do not rename API models or randomly restructure working application logic.

Functional regression is unacceptable.

---

# 4. DESIGN DIRECTION

Create a new design system for Focal V3.

The visual character should be:

## Enterprise Precision × Modern Fintech × Quiet Luxury

Think:

* highly structured
* calm
* premium
* modern
* serious
* operational
* intelligent
* technical
* trustworthy

NOT:

* gaming dashboard
* crypto dashboard
* generic AI SaaS
* cyberpunk
* neon UI
* giant gradients
* excessive glassmorphism
* excessive glowing borders
* floating blobs everywhere
* giant typography
* oversized cards
* excessive rounded rectangles
* excessive whitespace
* gimmicky 3D
* Dribbble concept that would be painful to use every day

This needs to look like a REAL enterprise product.

---

# 5. COLOR SYSTEM

Create semantic design tokens rather than scattering hardcoded colors.

Suggested brand foundation:

Primary / Trust Blue:

`#0098FF`

Use this as the principal interactive accent.

Enterprise Emerald:

`#004225`

Use selectively for positive financial/operational contexts.

Base background:

`#F4F5F7`

Use layered whites and subtle neutral surfaces.

Premium Accent Gold:

`#FFD700`

Use VERY sparingly.

Gold must never dominate the UI.

It may be used for:

* premium markers
* special account state
* tiny highlights
* exceptional statuses

Build proper semantic shades around these values.

Include:

* surface-primary
* surface-secondary
* surface-elevated
* border-subtle
* border-strong
* text-primary
* text-secondary
* text-tertiary
* interactive-primary
* success
* warning
* danger
* info
* focus-ring

Do not make every component blue.

---

# 6. 100% BROWSER ZOOM IS A HARD REQUIREMENT

This is extremely important.

The application currently risks feeling visually "zoomed in".

The redesign MUST look correctly proportioned at:

**Browser zoom = 100%**

Do NOT solve this using:

* CSS `zoom`
* transform scale()
* browser-specific scaling hacks
* globally shrinking the entire application
* changing device pixel assumptions

Create the correct proportions naturally.

Test at minimum:

* 1280 × 720
* 1366 × 768
* 1440 × 900
* 1536 × 864
* 1920 × 1080

And responsive widths below desktop.

At 1366 × 768 at 100% zoom:

* navigation must remain comfortable
* content should not feel oversized
* cards must not consume absurd vertical space
* dashboard content should show useful information above the fold
* headings should not resemble marketing-page hero titles
* controls should not look enormous
* sidebar should not consume excessive width
* unnecessary padding must be removed
* information density should resemble a serious productivity application

Recommended baseline direction:

* root text: approximately 14–16px depending on role
* body/interface text: usually 13–15px
* secondary text: 12–13px
* page title: generally 24–32px, not 50–70px
* control height: generally 34–42px
* compact enterprise controls may be 32–36px
* sidebar width: roughly 220–260px depending on content
* topbar: roughly 52–64px
* card radius: restrained
* spacing grid: consistent 4px / 8px based system

These are guidelines, not mandatory hardcoded numbers.

Judge visually.

---

# 7. DENSITY MATTERS

This is an operational productivity application.

Users may spend hours in it.

Optimize for:

* scanability
* fast navigation
* information density
* hierarchy
* predictable controls
* minimal eye travel

Whitespace should separate information.

Whitespace should NOT waste the screen.

Avoid the common AI-generated UI problem where every card has:

`padding: 32px`

and every section has:

`gap: 32px`

Use more sophisticated density.

---

# 8. TYPOGRAPHY

Establish a professional typography system.

Favor modern enterprise typography with excellent readability.

Do not depend on exotic typography purely for aesthetics.

Use:

* strong hierarchy
* moderate tracking
* tabular numbers for metrics where useful
* consistent weight hierarchy
* sensible line heights
* compact labels
* readable tables
* strong numerical displays

Avoid excessive uppercase.

Uppercase should primarily be reserved for tiny metadata labels when justified.

---

# 9. REDESIGN THE V3 SHELL

The V3 Shell should feel like the operating environment of Focal.

Make it exceptionally polished.

Pay close attention to:

### Sidebar

Improve:

* hierarchy
* selected state
* section grouping
* icons
* hover state
* focus state
* collapse behavior
* labels
* spacing
* active route indication
* nested navigation if present

The active state should be elegant and unmistakable without becoming a glowing pill.

### Header / Topbar

Improve:

* search
* command actions
* notifications
* profile
* contextual information
* breadcrumb/page context
* actions

Keep the header visually lightweight.

### Workspace

Create clear separation between:

* global navigation
* page navigation
* content
* utilities
* status information

The shell should frame the application rather than compete with it.

---

# 10. LOGIN PAGE

Completely redesign the login experience.

The login page should immediately communicate:

* security
* trust
* premium enterprise software
* operational intelligence
* financial-grade quality

Keep the form extremely simple.

Do not bury the authentication controls under visual decoration.

Desktop can use a carefully balanced split composition if appropriate.

Mobile should prioritize the form.

Use Three.js here only if it materially improves the brand experience.

Good Three.js directions include:

* restrained architectural grid
* subtle spatial network
* softly moving dimensional system
* abstract operational geometry
* controlled lines representing connected workflows
* subtle depth responding slightly to pointer position

BAD directions:

* floating 3D spheres
* random particles
* crypto globe
* neon tunnel
* spinning cube
* giant shiny object
* meaningless space scene
* flashy shader demonstration

---

# 11. THREE.JS — USE WITH RESTRAINT

Three.js is required as part of the redesign, but it must feel almost invisible.

The user should think:

> "This interface has unusual depth and polish."

Not:

> "Someone added a Three.js demo."

Use Three.js for one or a few carefully justified visual moments.

Strong candidates:

1. Login visual environment
2. extremely subtle shell background depth
3. contextual ambient geometry behind a special dashboard state

Do NOT render a heavy Three.js scene behind every page.

The application itself remains primarily semantic HTML/CSS/Angular.

---

# 12. THREE.JS PERFORMANCE RULES

Follow production WebGL practices.

Required:

* cap renderer pixel ratio
* resize correctly
* stop RAF when not visible
* stop RAF when route/component is destroyed
* pause when document becomes hidden
* pause when canvas is offscreen
* dispose geometry
* dispose materials
* dispose textures
* dispose renderer
* remove listeners
* remove observers
* handle Angular destroy lifecycle
* avoid per-frame object allocation
* minimize draw calls
* minimize transparent layers
* avoid expensive real-time shadows
* avoid unnecessary postprocessing
* support WebGL failure gracefully

Three.js must NEVER prevent:

* login
* navigation
* interaction
* content rendering

The static UI is always primary.

---

# 13. MOTION SYSTEM — REPLACE THE EXISTING ANIMATIONS

Audit ALL original animations currently used by the scoped components.

Do not simply layer additional animations on top.

Replace weak, inconsistent, dated, overly slow, or generic animations.

Create ONE unified motion language.

Animations should communicate:

* navigation
* hierarchy
* causality
* state changes
* confirmation
* spatial relationships

They should never exist only because movement "looks cool".

---

# 14. MOTION CHARACTER

The Focal motion language should feel:

* confident
* precise
* responsive
* smooth
* restrained
* slightly cinematic
* physically plausible
* fast enough for professional use

Think:

Apple-quality transitions

*

Linear-level responsiveness

*

high-end fintech restraint

NOT:

Awwwards portfolio scroll-jacking.

---

# 15. MOTION TIMING

Use different motion tiers.

### Micro interaction

Approximately:

`120–200ms`

Examples:

* hover
* button
* checkbox
* icon
* menu highlight

### UI transition

Approximately:

`180–320ms`

Examples:

* dropdown
* sidebar
* dialog
* navigation state
* tab transitions

### Major state transition

Approximately:

`350–600ms`

Only when justified.

Avoid making users wait for animations.

Use easing curves intentionally.

Prefer spring-like or carefully selected cubic-bezier motion over default `ease`.

---

# 16. SPECIFIC MOTION TO IMPROVE

Redesign motion for:

* initial login appearance
* authentication feedback
* shell initialization
* route/page transitions
* sidebar expansion/collapse
* selected nav item
* dropdowns
* profile menu
* notifications
* command/search interface
* modals
* drawers
* cards
* tabs
* tables where appropriate
* filters
* status changes
* buttons
* icon transitions
* tooltips
* loading
* empty states
* skeletons
* success/error feedback

Do not animate large amounts of content simultaneously.

Use stagger only when it provides hierarchy.

---

# 17. AVOID "EVERYTHING FADES UP"

Do NOT make the design rely on generic:

`opacity: 0 → 1`

*

`translateY(20px)`

for every component.

Use varied but coherent transitions based on component semantics.

For example:

* navigation = directional
* overlays = depth/elevation
* filters = localized transition
* cards = minimal state response
* numbers = controlled value transition
* drawers = spatial movement
* selected navigation = shared visual emphasis
* login hero = carefully choreographed entrance

---

# 18. PAGE TRANSITIONS

Page changes should feel connected to the shell.

The shell itself should remain stable.

Avoid animating the whole application out and back in.

Prefer:

* subtle content transition
* contextual movement
* small opacity shift
* intelligent skeleton/loading transition

Navigation must feel immediate.

---

# 19. MICRO-INTERACTIONS

Polish every relevant interactive state.

For buttons:

* hover
* active
* focus
* disabled
* loading

For inputs:

* idle
* hover
* focused
* completed
* error
* disabled

For navigation:

* idle
* hover
* active
* keyboard focus

For cards:

* idle
* actionable hover where applicable
* selected
* disabled
* loading

Make motion subtle enough that users may not consciously notice it.

That is a success.

---

# 20. SHADOWS / BORDERS / DEPTH

Avoid giant soft shadows everywhere.

Prefer:

* subtle borders
* tonal surface separation
* controlled elevation
* minimal shadows
* precise focus rings

Depth should come from hierarchy rather than decoration.

Use blur only where there is a functional visual reason.

---

# 21. GLASS EFFECTS

Glass may be used in isolated contexts such as:

* login visual
* temporary overlays
* command palette
* floating context menus

Do NOT build the whole interface from translucent glass cards.

Enterprise data surfaces should generally be opaque and readable.

---

# 22. ICONOGRAPHY

Use one icon family consistently.

Do not mix:

* outline icons
* emoji
* filled icons
* random SVG packs

Icons should have consistent:

* stroke width
* optical size
* bounding box
* alignment
* visual density

Remove unnecessary icons.

---

# 23. TABLES AND OPERATIONAL DATA

If V3 Shell contains tables or data-heavy interfaces, treat them as first-class UI.

Improve:

* row density
* headers
* sorting
* selected rows
* pagination
* filters
* status representation
* alignment
* numeric formatting
* hover state
* focus state
* horizontal overflow
* empty/loading states

Do not turn data tables into giant cards.

---

# 24. STATUS COLORS

Status colors should be semantic and controlled.

Avoid entire brightly colored cards.

Prefer small indicators, labels, icons, subtle tinted surfaces, or borders.

Error states should be noticeable.

Success states should not dominate the screen.

---

# 25. RESPONSIVE DESIGN

Do not treat mobile as a desktop layout squeezed smaller.

Test:

* mobile
* tablet
* laptop
* desktop
* large desktop

Navigation should transform appropriately.

Tables should have intentional responsive behavior.

Never allow:

* accidental horizontal scroll
* clipped controls
* unreadable dialogs
* buttons outside viewport
* hidden critical actions

---

# 26. ACCESSIBILITY

The redesign must support:

* keyboard navigation
* visible focus
* semantic elements
* correct labels
* WCAG-conscious contrast
* screen readers
* reduced motion
* touch
* coarse pointers

Implement:

`prefers-reduced-motion`

correctly.

Reduced motion must not merely make every animation slightly faster.

Where appropriate:

* remove transforms
* stop WebGL animation
* render final state immediately
* remove unnecessary parallax

---

# 27. ANIMATION PERFORMANCE AUDIT

Before changing animations, establish the current baseline.

Search for:

* `requestAnimationFrame`
* CSS animations
* CSS transitions
* Angular animations
* GSAP timelines
* intervals
* timeouts
* IntersectionObservers
* ResizeObservers
* WebGL
* canvas
* animation listeners

After implementation verify:

* no RAF running unnecessarily offscreen
* no duplicated animation loops
* no orphaned listeners
* no orphaned observers
* no WebGL memory leaks
* no animation continuing after route destruction

Page navigation should not progressively increase memory usage.

---

# 28. PERFORMANCE TARGET

The final interface must remain fast on normal corporate hardware.

A user should not need:

* dedicated graphics
* gaming hardware
* a high refresh-rate monitor

Three.js is enhancement, not a requirement for usability.

Prefer transform and opacity for high-frequency animation.

Avoid layout thrashing.

Do not continuously animate large blurred DOM elements.

Do not run decorative animation at full speed when the browser tab is hidden.

---

# 29. ANGULAR IMPLEMENTATION QUALITY

This is an Angular application.

Respect the project's current Angular architecture.

Prefer:

* reusable components
* centralized design tokens
* clear SCSS/CSS architecture
* CSS custom properties where useful
* reusable motion utilities
* proper lifecycle cleanup
* standalone patterns if the project already uses them
* signals if consistent with the project
* Angular CDK where appropriate

Do not introduce unnecessary dependencies.

Do not rewrite working Angular components into another framework.

---

# 30. DESIGN SYSTEM

Create or improve reusable foundations for:

### Tokens

* color
* typography
* spacing
* radius
* elevation
* borders
* motion
* z-index
* control heights
* content widths

### Components

Ensure consistency across:

* button
* icon button
* input
* select
* textarea
* checkbox
* radio
* toggle
* card
* badge
* tooltip
* dropdown
* menu
* dialog
* drawer
* tabs
* navigation item
* table
* skeleton
* alert
* toast

Do not manually recreate nearly identical styles in every page.

---

# 31. LOADING EXPERIENCE

Loading states should look intentional.

Avoid:

* aggressive shimmering
* massive skeleton blocks
* fake progress
* distracting looping animation

Prefer restrained skeletons or progressive content appearance.

Skeleton animation must stop when offscreen.

---

# 32. LOGIN MOTION CONCEPT

For login, build one particularly high-quality sequence.

Possible choreography:

1. static page is immediately usable
2. background spatial system initializes subtly
3. Focal identity appears
4. authentication panel settles into position
5. supporting visual details reveal quietly
6. pointer interaction creates extremely small depth response

Total effect should feel premium without delaying login.

Users should be able to immediately click the form.

---

# 33. SHELL INITIALIZATION

When entering V3 Shell:

Do NOT show a long cinematic intro.

The shell should appear almost immediately.

A possible sequence:

* base shell: immediate
* navigation: 150–250ms
* workspace: 200–350ms
* important page information: subtle reveal

The user must never wait for animation before working.

---

# 34. INTERACTION FEEL

Clicks should feel immediate.

Avoid artificially delaying route navigation so an animation can finish.

Motion should adapt to application state, not control application state.

---

# 35. CONTENT PRIORITY

Never sacrifice readability to animation.

Never sacrifice information density to aesthetics.

Never sacrifice application reliability to Three.js.

Priority order:

1. functionality
2. readability
3. navigation
4. accessibility
5. performance
6. visual hierarchy
7. motion
8. decoration

---

# 36. DO NOT CREATE A "DESIGN DEMO"

This work must modify the actual application.

Do NOT:

* create an isolated HTML mockup instead of implementing it
* build a separate demo route
* replace real data with fake dashboard examples
* remove functionality to simplify the design
* hard-code mock enterprise statistics
* redesign only the first visible viewport

Transform the REAL V3 Shell and Login implementation.

---

# 37. DO NOT OVER-DESIGN

Continuously ask:

> Would a bank deploy this interface to thousands of employees?

> Would someone comfortably use this for an eight-hour workday?

> Does this look designed rather than generated?

> Would the design still look good without animation?

If no, simplify it.

---

# 38. VISUAL QUALITY BAR

The final result should feel suitable for:

* enterprise customer support
* banking
* fintech operations
* risk operations
* technical support
* KYC operations
* incident management
* workflow management
* knowledge management
* internal AI assistance

The style should communicate:

**control, trust, intelligence and precision.**

---

# 39. BROWSER VERIFICATION IS REQUIRED

Do not consider the implementation finished after compilation.

Run the application.

Inspect it visually.

Use the browser at **100% zoom**.

Check at minimum:

### Desktop

1366 × 768

1440 × 900

1920 × 1080

### Tablet

approximately 768px width

### Mobile

approximately 390px width

Check:

* V3 Shell
* Login
* sidebar expanded
* sidebar collapsed
* dropdowns
* modals if accessible
* hover states
* keyboard focus
* page scrolling
* navigation
* loading
* common data surfaces

Fix visual problems you discover.

---

# 40. VISUAL DENSITY REVIEW

At 1366 × 768 / 100% zoom specifically inspect whether:

* headers are oversized
* cards are oversized
* padding is excessive
* navigation wastes space
* typography feels enlarged
* important content falls unnecessarily below fold
* buttons feel mobile-sized
* dashboard information density is too low

Correct these problems.

Do not tell me to reduce browser zoom.

100% zoom is the target.

---

# 41. MOTION VERIFICATION

Verify animations at runtime.

Check:

* no jank
* no layout jumps
* no content flashes
* no transform causing text blur
* no transition from incorrect initial state
* no delayed interaction
* no scroll hijacking
* no conflicting animations
* no route-transition glitches
* no WebGL canvas flash
* no GPU-heavy loop continuing after leaving page

---

# 42. THREE.JS FALLBACK

The Login and V3 Shell must remain complete if:

* WebGL is disabled
* Three.js fails
* reduced motion is active
* JavaScript animation initialization fails

Three.js enhances the experience.

It does not define the layout.

---

# 43. CLEAN UP THE OLD DESIGN

Do not leave abandoned:

* CSS
* keyframes
* animation classes
* unused dependencies
* obsolete variables
* duplicate styles
* abandoned WebGL code
* stale imports

Remove old implementations when safely superseded.

Do not maintain two competing visual systems.

---

# 44. TEST EXISTING FUNCTIONALITY

After redesign:

* authenticate
* navigate
* expand/collapse navigation
* interact with inputs
* open relevant menus
* test critical actions
* verify routes
* inspect console
* verify no Angular runtime errors
* verify no new warnings where avoidable

Run the project's existing:

* lint
* type checking
* tests
* build

Do not declare success while the project fails to compile.

---

# 45. IMPLEMENTATION STRATEGY

Perform this work in deliberate phases.

## Phase 1 — Audit

Discover scoped components, dependencies, existing styling and animation.

## Phase 2 — Foundations

Create design tokens, typography, spacing, surfaces, components and motion language.

## Phase 3 — Shell

Transform V3 Shell and all visually participating components.

## Phase 4 — Login

Transform login and introduce the restrained Three.js brand moment.

## Phase 5 — Motion

Replace old animation behavior with the new unified motion system.

## Phase 6 — Performance

Profile CSS/JS/WebGL animation and remove unnecessary work.

## Phase 7 — Responsive

Correct density across viewport sizes.

## Phase 8 — QA

Build, test, visually inspect and refine.

Do not stop after Phase 3 or after making the first screenshots look attractive.

---

# 46. AUTONOMY

Do not continuously ask me which small design option I prefer.

Use professional design judgment.

Inspect the existing application and preserve useful product patterns.

If there are several reasonable implementation approaches, choose the one that gives:

1. highest usability
2. strongest architectural consistency
3. best performance
4. easiest maintenance
5. best visual quality

Proceed autonomously.

---

# 47. IMPORTANT NEGATIVE REQUIREMENTS

ABSOLUTELY AVOID:

* huge hero typography inside the application
* random gradients
* purple AI gradients
* glowing AI orb
* particle soup
* crypto aesthetics
* unnecessary 3D objects
* excessive transparency
* huge border radius everywhere
* nested cards inside cards inside cards
* every component floating
* excessive shadows
* 20px body typography
* 48px buttons
* giant whitespace
* hidden navigation
* invisible borders
* low contrast gray text
* scroll-jacking
* animation on every element
* animation delays that block work
* multiple simultaneous smooth-scroll systems
* unnecessary libraries
* fake metrics
* fake customer logos
* fake compliance indicators
* visual effects that reduce information density

---

# 48. DEFINITION OF DONE

The task is NOT complete until all of the following are true:

* V3 Shell has been redesigned
* every visually used V3 Shell component has been reviewed and updated where required
* Login has been redesigned
* every visually used Login component has been reviewed and updated
* original weak animations have been removed/replaced
* the new motion system feels coherent
* Three.js is implemented purposefully
* Three.js has safe cleanup
* Three.js has fallback behavior
* reduced motion works
* accessibility remains strong
* desktop 100% zoom looks correctly scaled
* 1366 × 768 is genuinely usable
* responsive states work
* old redundant styling has been cleaned
* existing functionality still works
* browser console has no redesign-related errors
* lint/build/tests have been checked
* animation performance has been verified
* the application looks cohesive rather than page-by-page generated

---

# 49. FINAL REVIEW STANDARD

Before finishing, review the result as though you are simultaneously presenting it to:

* an Apple design review
* a Microsoft enterprise UX team
* a Citi digital banking team
* a fintech security team
* an enterprise accessibility auditor
* a frontend performance engineer
* a staff Angular engineer

If an effect is impressive but harms usability, remove it.

If something looks generic, refine it.

If something looks AI-generated, simplify it.

If something looks visually oversized at 100% zoom, reduce it.

If Three.js attracts more attention than the product, reduce it.

If the animation makes an experienced user slower, shorten or remove it.

The goal is not maximum visual effects.

The goal is:

# EXCEPTIONALLY POLISHED ENTERPRISE SOFTWARE.

Implement the redesign completely.
