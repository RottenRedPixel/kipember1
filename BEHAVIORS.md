# Ember — UI Behavior Spec

This file documents intended UI behavior rules to guide implementation decisions.

---

## Implementation Rule — Follow Existing Patterns

**When creating any new screen, component, or layout, always match the existing design system exactly. Do not introduce new values.**

- **Buttons**: Use only the 2 defined styles (primary / secondary). Follow the exact height, font, shape, and rollover rules. No icons inside buttons.
- **Typography**: Use only `text-xs`, `text-sm`, `text-base`, or `text-2xl`. Use only `font-normal`, `font-medium`, or `font-bold` (bold only on `text-2xl`). Do not introduce `text-lg`, `text-xl`, `text-3xl`, `font-semibold`, or any other size/weight.
- **Colors**: Use only the 4 approved text colors (`text-white`, `text-white/60`, `text-white/30`, `#f97316`). Do not use `text-white/50`, `text-white/40`, `text-white/70`, or any other opacity variant.
- **Backgrounds**: Main screens use `#171515`. Modals use `rgba(0,0,0,0.75)` with `blur(5px)`. Do not introduce new background colors.
- **Spacing and layout**: Match existing screen padding, gap values, and alignment patterns from nearby components rather than inventing new ones.

When in doubt, read an existing screen file and mirror its structure.

---

## Typography

### Ember_Header
The app's primary heading style: `text-base font-medium` (16px). Used for all screen titles, modal headings, and key UI labels including:
- Ember title on memory view ("Beach Day")
- "Create your first ember"
- "Create an ember from this photo?"
- Processing screen step heading
- "Ember Chat" / "Start your journey here"
- "Tend & grow this ember"
- "Share this ember"
- User name in user modal

---

## Buttons

### No icons in buttons
Buttons must contain text labels only — no icons. Icons add visual noise and the label alone is sufficient when copy is clear. Reserve icons for standalone navigation actions where there is no label (e.g. icon-only rail buttons, send button, close button).

### Standard style
- Font: `text-sm font-semibold`
- Shape: `rounded-full`
- Height: `minHeight: 44` (44px — Apple/WCAG minimum touch target). Never use `py-3` or `h-12` for buttons. Always set `minHeight: 44` in the inline style, with `flex items-center justify-center` in className.
- **Primary**: `background: #f97316`, white text — used for the main/preferred action
- **Secondary**: `background: transparent`, `border: 1.5px solid rgba(255,255,255,0.35)`, white text — used for all other actions (cancel, back, alternative choices)

There are only 2 button styles. Ghost buttons (semi-transparent fill, no border) are not used — convert any to secondary.

### Rollover (desktop only)
Always add the matching CSS class to enable hover effects (scoped to `pointer: fine` devices — never fires on touch):
- Primary buttons: add `btn-primary` class → darkens with `filter: brightness(0.88)` on hover
- Secondary buttons: add `btn-secondary` class → shows subtle white fill via `box-shadow: inset 0 0 0 100px rgba(255,255,255,0.08)` on hover (inset shadow avoids conflicts with inline background styles)

---

## Ember Chat

### Height when expanded
The ember chat height when open should be **relative to its content**, not a fixed percentage of the screen. The bar should grow to comfortably fit the conversation messages and the reply input, with breathing room — not a hard-coded `50vh`. As the conversation grows with more messages, the bar may expand further, up to a maximum cap (e.g. 70vh) before scrolling the message area internally.

### Collapsed state
The collapsed bar shows a single-line prompt and the flame icon. Height is determined by its content (auto).

### Rail visibility
When the ember chat is open (expanded), the right rail is hidden. When the bar collapses, the rail reappears.

### Reply input row layout
The reply row uses `pl-4 pr-[22px] pb-6 pt-1` with `gap-3` between elements:
- **Input field**: `flex-1`, rounded-full, `bg-white/10`, placeholder text `"reply to ember..."` (all lowercase), `px-4 py-2.5`, border `white/10` → `white/30` on focus
- **Send button**: `w-10 h-10` (40px) rounded-full, always orange `#f97316`, contains `<Send size={16} color="white" />`
- The `pr-[22px]` right padding aligns the send button's center at 42px from the right edge — matching the rail circle alignment exactly.

### Send button
The send button is always orange (not conditional on input content).

---

## Modals (Share / Tend)

### Appearance
- Background: `rgba(0,0,0,0.75)` black with `blur(5px)` backdrop filter
- Border: `1px solid rgba(255,255,255,0.08)`
- Border radius: `16px`
- Position: anchored to bottom of screen, above the ember chat

### Dismissal
Tapping the backdrop or the X button closes the modal (navigates to `/home`).

### Rail visibility
The rail remains visible when a modal is open.

---

## Right Rail

### Alignment
All rail icon circles are `40×40px`. Right edge padding is `pr-[22px]`, aligning circle centers at 42px from the right edge. The send button in the ember chat input row matches this alignment.

### Avatar
User avatar sits at the top of the rail, above the action buttons.

---

## Top Chrome

### Position
Home button and memory title sit at the top of the screen with no safe-area offset (intentional — safe area handling to be revisited when integrating with native shell).

---

---

## Ember Chat — Component Names

| Component | Description |
|---|---|
| `Ember Chat` | Full container — wraps all sub-components, anchored to bottom of screen |
| `EmberHandle` | Collapsed row — shows prompt text on the left and flame/chevron button on the right |
| `EmberPanel` | Expanded content area — the chat thread region that grows with content |
| `EmberMessage` | A single message bubble from Ember (the AI), left-aligned, orange-tinted |
| `EmberActions` | CTA button row rendered inside the chat thread (e.g. invite others / add to memory) |
| `EmberInput` | Reply input row — text field + send button, pinned to bottom of `Ember Chat` |

---

## Ember Chat — Message Model

**Everything in `EmberPanel` is a chat thread.** There is one visual language: chat bubbles.

- **Ember messages** (`EmberMessage`): left-aligned, orange-tinted bubble, labeled with sender name "ember". Generated by the system based on app state — the first message in every thread is context-driven (see State Map below).
- **User messages**: right-aligned, white/neutral bubble. Appear after the user replies via `EmberInput`.
- **State-based prompts are not treated differently** — they are simply Ember's opening message in the thread. The state determines *what* Ember says first, not *how* it looks.
- `EmberActions` (CTA buttons) appear inline in the thread, below Ember's opening message, when a quick-action response is appropriate.

---

## Ember Chat — State Map

State determines what Ember says first and which CTAs appear. See **STATES.md** for the full state definitions, transition table, Mermaid diagram, and API data contracts.

> State is passed as a prop or derived from auth context + ember metadata returned by the API.

---

## Typography System

Four font sizes, three weights. No other sizes or weights are used.

| Token | Tailwind | Use |
|---|---|---|
| `text-xs` | 12px | Timestamps, badges, fine print |
| `text-sm` | 14px | Body copy, form fields, secondary text |
| `text-base` | 16px | `Ember_Header` — screen titles, modal headings, key UI labels |
| `text-2xl` | 24px | Page-level hero headings only (e.g. "ask ember") |

| Weight | Tailwind | Use |
|---|---|---|
| Regular | `font-normal` | Default body text |
| Medium | `font-medium` | Labels, buttons, UI elements |
| Bold | `font-bold` | `text-2xl` headings only |

---

## Color System

Four text/icon colors. No other opacity values or inline rgba text colors are used.

| Value | Tailwind | Use |
|---|---|---|
| `#ffffff` | `text-white` | Primary labels, headings |
| `rgba(255,255,255,0.6)` | `text-white/60` | Secondary / supporting text |
| `rgba(255,255,255,0.3)` | `text-white/30` | Tertiary / placeholder / muted |
| `#f97316` | `text-orange-500` | Brand accent, active states |

*Add new behavior notes here as decisions are made.*
