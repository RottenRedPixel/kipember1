# Ember Traces

Contextual facts about the moment of an ember, pulled from free external APIs and injected into Ember's conversation context alongside the wiki.

**The distinction:** The wiki is human memory — stories, details, contributions. Ember Traces are objective facts that are always true regardless of who's talking. The weather was 14°C. It was a Sunday. The moon was waxing gibbous. These never change and never belong to anyone.

---

## Data Sources

All free, no auth required or free tier sufficient. All inputs (location, date) already exist on every ember.

| Trace | Source | Inputs |
|---|---|---|
| Weather — temp, conditions, precipitation | Open-Meteo | lat/lng + date |
| Sunrise / sunset time | Open-Meteo or sunrise-sunset.org | lat/lng + date |
| Moon phase | Pure calculation (no API needed) | date |
| Day of week + public holidays | Nager.Date | date + country |
| Reverse geocode — neighbourhood / landmark name | Nominatim / OpenStreetMap | lat/lng |
| Timezone from coordinates | TimeZoneDB free tier | lat/lng |

**Highest value, lowest effort to start:** weather + reverse geocode + moon phase. These three alone make Ember feel remarkably informed about any memory.

---

## Architecture

### Storage
Dedicated `EmberTrace` table, keyed by ember ID.

```
EmberTrace {
  id
  emberId       → Image.id
  traceType     e.g. 'weather' | 'moon_phase' | 'geocode' | 'sunrise' | 'holiday' | 'timezone'
  renderedValue plain-text value Ember can speak ("8°C, light rain")
  rawResponse   full API JSON for debugging / re-rendering
  fetchedAt     timestamp
  flaggedAt     nullable — owner flagged this as incorrect
}
```

### Fetch strategy
- Computed **once per ember per trace type**, cached permanently
- Location and date never change on an ember — results are immutable
- On first request, fetch all applicable traces in parallel, store results
- All subsequent requests read from the table — zero API cost

### Prompt injection
Traces are injected into Ember's system prompt context alongside the wiki, as a separate `{{traces}}` variable. Ember can reference them naturally in chat, voice, and call without any special handling.

---

## Visibility & Editability

| | |
|---|---|
| Visible to owner | Yes — read-only "About This Moment" block in the View Wiki slider, below human-contributed content |
| Visible in chat / voice / call | Yes — injected into Ember's context so it can reference them naturally |
| Editable | No — facts are not opinions |
| Flag as incorrect | Yes — one flag option per trace for bad data (e.g. wrong geocode result) |

---

## Admin Panel — Ember Traces

Single panel under `/admin/ember-traces`.

### Configuration
- Toggle each trace type on/off individually
- Set which roles can trigger a fetch (owner / contributor / guest)

### Monitoring
- API call counts per trace type (daily / weekly view)
- Failure rate per source
- Average latency per source

### Cache
- Global cache hit rate
- Manual cache clear per ember (for bad data, pre-flag)

### Logs
- Recent lookups with outcome: hit / miss / error
- Which embers triggered which traces
- Flagged traces queue

---

## Implementation Order

1. `EmberTrace` Prisma model + migration
2. Fetch + cache layer — one function per trace type, all called in parallel
3. Inject `{{traces}}` variable into chat, voice, and call prompt contexts
4. View Wiki slider — "About This Moment" read-only display block
5. Admin panel — Ember Traces
6. Flag-as-incorrect UI in View Wiki slider

---

## Why Caching Matters

After the first visitor triggers a fetch, every subsequent answer is instant and free. Zero ongoing API cost once an ember's traces are warm. A popular shared ember could have thousands of conversations — all drawing from a single cached fetch.
