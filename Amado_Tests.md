# Amado_Tests

Manual test plan. Each entry follows the same shape so they can be run in order.

---

## Template

```
### T-XXX — <short title>
**Area:** <feature area, e.g. Ember Call, Wiki, Stories>
**Preconditions:** <state the system must be in before starting>
**Steps:**
1. <action>
2. <action>
**Expected:** <what should happen>
**Status:** [ ] pass  [ ] fail
**Notes:**
```

---

### T-001 — View landing page (logged out)
**Area:** Public pages
**Preconditions:** No active session (logged out).
**Steps:**
1. Open the site root `/` in a fresh browser / incognito window.
**Expected:** Landing page renders without redirecting to login. No auth errors in console.
**Status:** [ ] pass  [ ] fail
**Notes:**

### T-002 — View About page (logged out)
**Area:** Public pages
**Preconditions:** No active session (logged out).
**Steps:**
1. Navigate to `/about`.
**Expected:** About page renders without redirecting to login. No auth errors in console.
**Status:** [ ] pass  [ ] fail
**Notes:**

### T-003 — View Login / Sign Up page (logged out)
**Area:** Auth
**Preconditions:** No active session (logged out).
**Steps:**
1. Navigate to the login / sign-up page.
**Expected:** Page renders with both Login and Sign Up options visible and functional.
**Status:** [ ] pass  [ ] fail
**Notes:**

