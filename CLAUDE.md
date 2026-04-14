@AGENTS.md

# Mobile & iOS Rules

## Touch targets
Every tappable element must have a minimum tap area of 44×44px.
- Buttons: ensure `min-height: 44px` or Tailwind `h-11` / `py-3`
- Text-only links (e.g. "Sign In"): add `py-3 px-6` so the invisible tap area is large enough
- `<button>` elements always need `cursor: pointer` — iOS Safari won't fire tap events reliably without it

## NEVER use opacity transitions inside backdrop-filter containers
Animating `opacity` on any element inside a `backdrop-filter` parent is broken on both iOS and Android mobile browsers. The GPU compositor does not repaint children correctly. `will-change`, `translateZ(0)`, and other GPU-forcing hacks are NOT reliable fixes.

**The only reliable fix: use `color` transitions instead of `opacity`.**

```tsx
// BAD — broken on mobile inside backdrop-filter:
style={{ opacity: visible ? 1 : 0, transition: "opacity 0.8s ease" }}

// GOOD — works everywhere:
style={{ color: visible ? "#ffffff" : "transparent", transition: "color 0.8s ease" }}
```

This applies to ALL text that fades in/out inside any blurred/frosted container (modals, overlays, sheets).

## CSS animations inside backdrop-filter throttle the JS event loop on iOS
Running CSS `transform` or `animation` on many elements simultaneously inside a `backdrop-filter` container saturates the iOS GPU compositor, causing `setTimeout` / `setInterval` callbacks to be delayed or never fire.

**The fix: remove `backdrop-filter` from any container that also runs JS-timed state changes (e.g. auto-advancing text, countdowns). Use a solid/semi-opaque background instead.**

```tsx
// BAD — 30 animated bars inside backdrop-filter freezes JS timers on iOS:
style={{ backdropFilter: "blur(5px)", background: "rgba(0,0,0,0.75)" }}

// GOOD — solid background, no compositing overhead:
style={{ background: "rgba(18,18,18,0.97)" }}
```

## General interactive element checklist
- `<a>` / Next.js `<Link>`: renders as `<a>` — natively tappable, but still needs sufficient padding
- `<button>`: add `cursor: pointer` inline or via Tailwind `cursor-pointer`
- `<div onClick>`: avoid — use `<button>` instead; iOS won't fire click on a plain div

## NEVER use plain hover:opacity on interactive elements — scope to pointer devices only
On iOS/Android, CSS `:hover` activates on the **first tap** (changing opacity), and the click event only fires on the **second tap**. Users think the button is broken.

**Always scope opacity hover effects with `[@media(hover:hover)]`** so they only apply to real pointer devices (mouse/trackpad). Touch devices never match this query.

```tsx
// BAD — requires two taps on iOS:
<div className="opacity-60 hover:opacity-100 transition-opacity duration-200">

// GOOD — use the can-hover utility class (defined in globals.css):
<div className="opacity-60 can-hover">
```

The `can-hover` class is defined in `globals.css` using `@media (hover: hover) and (pointer: fine)` — it only applies on real pointer devices (mouse/trackpad), never on touch screens.

## Ember Chat workflow interactions — use Links, not onClick buttons
Inside the Ember Chat (which uses `backdrop-filter: blur`), `<button onClick>` with `useState` is **not reliable on iOS Safari or Android**. Touch events on onClick handlers fail silently.

**The only reliable fix: use URL-driven `<Link>` + `useSearchParams` instead of state.**

```tsx
// BAD — onClick inside backdrop-filter broken on mobile:
const [step, setStep] = useState(null);
<button onClick={() => setStep("adding")}>Add to Memory</button>

// GOOD — Link navigation works everywhere:
const step = useSearchParams().get("step");
<Link href="/home?ember=welcome&step=adding">Add to Memory</Link>
```

This pattern is used in all workflow components. State is read from the URL via `useSearchParams()`, and each choice navigates to a URL with a `step=` param (e.g. `step=adding`, `step=phone`, `step=chat`).

# Architecture

## Screen naming
- **Landing Page** (`/`) — intro + sign up / sign in
- **Sign Up** (`/signup`) — account creation
- **Sign In** (`/signin`) — login
- **Memory View** (`/home`) — main screen showing a memory (photo, title, date) with the right rail (user avatar, share, tend, play) and Ember Chat

## Slider pattern
All detail screens use a consistent slider panel: 93% width, 7% peek on the left to go back, header with back chevron + icon + title, scrollable content area.

Structure: constants file (actions map + icons map) → dynamic `[action]` route → slider page.

- **Tend sliders** (`/tend/[action]`) — Add Content, View Wiki, Edit Snapshot, Tag People, Edit Title, Contributors, Settings
- **User sliders** (`/user/[action]`) — My Embers, Shared Embers, Create Ember, Profile
- Back links return to the modal that opened them (`/home?m=tend` or `/home?m=user`)

## Modals
URL-driven via `?m=` param on `/home`. Current modals: `user`, `share`, `tend`, `play`.

Each modal uses the shared `<Modal>` wrapper (frosted glass card, X to close, centered at bottom). Items inside use `<SvgItem>` (icon + label in a 3-column grid).

## Ember Chat workflow pattern
The Ember Chat is a persistent shell at the bottom of Memory View. It has two parts:

1. **Shell** (Ember Chat component) — handles open/close toggle, flame button, container animation. Always the same regardless of workflow.
2. **Workflow slot** — an interchangeable inner component that renders the current workflow's UI.

### Workflow routing
Driven by URL param: `/home?ember=welcome`, `/home?ember=recording`, `/home?ember=invite`, etc.

### Planned workflows
| Param | Component | Purpose |
|---|---|---|
| `welcome` | WelcomeFlow | Default — "invite others" / "add to memory" buttons + intro chat |
| `owner-add` | OwnerAddFlow | Owner adding content — record voice, add photo, write a note |
| `contrib-add` | ContributorAddFlow | Contributor sharing a memory — record voice, share memory |
| `owner-add-more` | OwnerAddMoreFlow | Owner adding more content to an existing memory |
| `contrib-add-more` | ContributorAddMoreFlow | Contributor adding more to a memory — phone or chat |
| `recording` | RecordingFlow | Mic controls, live waveform, transcript |
| `invite` | InviteFlow | Share invite link, contacts picker |
| `story-circle` | StoryCircleFlow | Group conversation UI |
| `review` | ReviewFlow | Review/approve a contribution |

### File structure
```
app/components/
  Ember Chat.tsx              — shell (toggle, container, animation)
  workflows/
    WelcomeFlow.tsx         — current "invite others / add to memory"
    OwnerAddFlow.tsx        — owner adding content (voice, photo, note)
    ContributorAddFlow.tsx  — contributor sharing a memory
    OwnerAddMoreFlow.tsx    — owner adding more to a memory
    ContributorAddMoreFlow.tsx — contributor adding more to a memory
    RecordingFlow.tsx       — mic + waveform
    InviteFlow.tsx          — share invite link
    StoryCircleFlow.tsx     — group conversation
    ReviewFlow.tsx          — approve contributions
```

### Rules for workflows
- Each workflow is a standalone component in `app/components/workflows/`
- Receives `onClose` callback from the shell — the workflow never controls open/close
- Adding a new workflow = one new file + one entry in a lookup map in Ember Chat
- Shell handles all layout, animation, and backdrop — workflow only owns its inner content
- URL-driven so deep linking works (e.g. open app straight into recording)
