# Future Fixes

## Button Audit — Mobile/iOS Rule Violations

Findings from audit against CLAUDE.md button rules (touch targets, cursor-pointer, hover behavior).

### Missing `cursor-pointer`

| File | Line(s) | Element | Issue |
|------|---------|---------|-------|
| `src/components/kipember/HomeScreen.tsx` | 551 | Back button in first-ember flow | Missing `cursor-pointer` |
| `src/components/kipember/HomeScreen.tsx` | 675, 676, 680 | Share modal buttons (Copy Link, Message, More) | Missing `cursor-pointer` |
| `src/components/kipember/TendActionScreen.tsx` | 743, 759 | Call / Text icon action buttons | Missing `cursor-pointer` |
| `src/components/kipember/KipemberSnapshotEditor.tsx` | 482, 504, 516, 570, 620 | Duration chips, toggle cards, media selectors, contributor selectors | Missing `cursor-pointer` |
| `src/components/ContributorList.tsx` | 286, 321 | Action buttons | Missing `cursor-pointer` |

### Undersized Buttons (below 44px min-height)

| File | Line | Element | Issue |
|------|------|---------|-------|
| `src/components/kipember/KipemberSnapshotEditor.tsx` | 482 | Duration chips | `py-2` (~32px), needs `minHeight: 44` |
| `src/components/kipember/KipemberSnapshotEditor.tsx` | 504, 516 | Owner Voice / Ember Voice toggle cards | `py-3` (~36px), needs `minHeight: 44` |

### No violations found
- Plain `hover:opacity` without `can-hover` / `[@media(hover:hover)]` — none
- Opacity transitions inside `backdrop-filter` containers — none
