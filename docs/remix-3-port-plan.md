# Remix 3 port assessment

## Update: October 12, 2026

The port now uses `remix@3.0.0`, the latest stable npm release verified on
October 12. The [official release notes](https://github.com/remix-run/remix/releases/tag/remix%403.0.0)
cover the runtime rename from `remix/ui` to `remix/component`; imports, server
rendering, browser tests, and TypeScript's JSX source now use the stable paths.
Router context augmentation now targets the type-only `remix` root module.

Feature parity was checked against `main` at `8d6066b`, also confirmed as the
current remote main commit. Shared dependency declarations and locked direct
versions match main. The schema, SQLite import/validation scripts, and search
query behavior already matched, including all eight filters, faceted option
counts, canonical metadata, channel ID matching, and pagination.

The audit closed five UI gaps:

- Unknown GET/HEAD paths now render the styled 404 page with a home link.
- Enter in the advanced-filter search no longer submits an empty form and drops
  active filters.
- Opening or reopening a long picker scrolls the selected option into view.
- Long advanced-filter lists scroll without clipping their tabs or search row.
- Canceled filter navigation no longer retries the old URL after a newer action
  such as Reset. A regression exercises real browser navigation cancellation.

Validation: 33 server/database/pure tests and 7 Chromium browser tests pass,
along with lint, TypeScript, Knip, and the production build. Lint still reports
non-blocking style warnings. Browser tests include regressions for the picker
fixes; route tests cover styled nested 404s, HEAD, and POST method handling.

Production-preview browser checks also passed against the existing local D1
dataset of 6,192 performances: keyboard selection, real Enter submission,
channel/card filters, reset, pagination, back/forward history, 390px mobile
picker bounds, styled 404 recovery, and native filtering with JavaScript
disabled. No browser runtime errors were observed.

A visual follow-up against the supplied screenshots and live main at matching
1440px and 390px browser widths restored the shaded card-filter labels and
matched both pickers' dimensions, row spacing, typography, count formatting,
separator, borders, and tab sizing. Form font inheritance now has low CSS
specificity so local control typography applies correctly. The extra channel
external-link icon was removed to match main. The existing tests and the
complete check command still pass. The differing result totals and videos come
from the separate local D1 snapshots; this visual change does not refresh data.

The final cleanup consolidates all eight Radix icons into `app/ui/icons.tsx`,
retains their MIT notice, and centralizes the existing palette in
`app/ui/colors.ts`. The primary picker no longer exposes unused empty-option
configuration or duplicate placeholder props. Five desktop/mobile screenshots
(initial results, both pickers, active filters, and the mobile picker) are
byte-for-byte identical before and after these refactors.

The final production preview also passed the delayed-filter/Reset race check
without reloading the document. WebKit 26.4 smoke checks passed primary and
advanced filtering, Reset, pagination/history, mobile picker positioning and
keyboard dismissal, native no-JavaScript filtering, and 404 recovery with no
uncaught browser errors. Firefox 150.0.2 could not start in the local test
environment (native sandbox/framebuffer errors before loading the app), so its
behavior remains unverified.

The September update and original beta assessment below are historical.

## Update: September 23, 2026

The port now uses `remix@3.0.0-rc.3`, the current Remix 3 release on the npm
`next` tag. Shared tooling and pnpm versions match `main` at `e8995ab`.

The product changes through that main commit are present: YouTube channel
filtering, canonical result metadata, explicit event/year states, compact
sentence-style advanced filters, mobile search spacing, and validated SQLite
imports. The schema, database import scripts, and query behavior match main;
Remix-specific rendering and navigation remain separate.

The upgrade uses Remix's built-in frame resolver and navigation fallback, and
moves browser test configuration to `remix.json`. CI installs Chromium before
running checks. Main's assertions for renamed channels, exact channel IDs, and
event option values are also covered by this branch's tests.

The original assessment below describes the beta.5 starting point.

Status: the server-owned route, Cloudflare/D1 runtime path, and focused
search-controls client entry are implemented. Automated checks now cover the
native GET fallback, URL semantics, faceted D1 queries, keyboard search,
optional-filter chips, GET/HEAD responses, and production Worker/client builds.
The remaining cutover work is operational verification with a representative
local database snapshot and any deployment decision; nothing has been
published.

## Executive finding

Tango Video Search is not a conventional React SPA that needs to be redesigned
for a server-first framework. It is already a server-rendered React Router v8
framework app, descended from Remix, with:

- one public search route driven by URL search parameters;
- a server loader that queries Cloudflare D1 through Drizzle;
- a thin Cloudflare Worker request adapter;
- typed route modules and streaming SSR;
- pure tests for URL-state behavior and Workerd-backed D1 tests.

The Remix 3 port should therefore preserve the product, URL contract, search
semantics, D1 schema, query behavior, and Cloudflare deployment. The meaningful
change is the ownership model:

```text
Current
request
  -> React Router request handler
    -> route loader
      -> Drizzle/D1 search module
    -> React document + hydrated router

Remix 3
request
  -> Remix router
    -> typed controller
      -> Drizzle/D1 search module
      -> explicit HTML Response
    -> remix/ui streamed document
      -> one optional search-controls client entry
```

This is a framework translation, not a reason to replace the database layer,
invent new routes, or alter the UI.

## Sources inspected

### Tango Video Search

- `app/routes/_index.tsx` owns the loader and current page composition.
- `app/search.ts` owns URL parsing and deterministic URL transitions.
- `app/db.server.ts` owns the complete faceted-search query.
- `app/components/combobox.tsx` contains most browser-only behavior.
- `workers/app.ts`, `vite.config.ts`, and `wrangler.jsonc` define the current
  Cloudflare runtime.
- Existing tests cover URL-state transitions, faceted option scoping,
  pagination, and D1 behavior.

### Local Remix 3 references

- **R3Faster** is the closest architectural case study. Its useful precedent is
  the translation sequence: inventory behavior, define the server contract,
  replace runtime seams, then reintroduce only justified browser behavior.
- **books.christianrotzoll.com** is the closest application shape: one
  D1-backed, server-rendered content route plus a focused hydrated UI. Its
  fixed client entry is simpler and more appropriate for Tango than R3Faster's
  multi-entry Vite manifest bridge.
- **site-by-site** is useful mainly as a counterexample. Its large client entry
  is justified by IndexedDB, drag interactions, keyboard control, and
  client-owned state. Tango's durable state is the URL and D1, so that
  client-heavy shape would be a regression.

All three reference apps currently use `remix@3.0.0-beta.5` and the Cloudflare
Vite plugin.

## Product contract to preserve

The first port milestone should be judged against these invariants:

1. `GET /` renders useful HTML on the server.
2. The query-string keys remain `dancer1`, `dancer2`, `orchestra`, `song`,
   `singer`, `event`, `year`, and `page`.
3. Selecting or clearing a filter resets pagination.
4. Video-card metadata can add, replace, or remove the matching filter.
5. At most two dancer filters are active.
6. Facet option counts remain scoped by every other active filter.
7. Pagination remains clamped and preserves active filters.
8. Result ordering remains performance year, then YouTube publication date,
   descending.
9. The page remains responsive and accessible, including keyboard use of the
   searchable combobox.
10. D1 remains the production database, Drizzle remains the query builder for
    the first port, and the database import workflow remains unchanged.
11. Cloudflare Workers, Static Assets, preview deployments, and observability
    remain the runtime orientation.

## Layer-by-layer translation

| Concern          | Current expression                               | Remix 3 expression                                                                            |
| ---------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| URL contract     | React Router route config plus route file        | `app/routes.ts` using `route`, `get`, and `head` from `remix/routes`                          |
| Request handling | route `loader`                                   | root controller action returning an explicit `Response`                                       |
| Request context  | `RouterContextProvider` carrying Worker bindings | small database middleware setting a typed Remix context key                                   |
| Rendering        | React 19 + `ServerRouter`                        | `remix/ui/server` stream wrapped by `createHtmlResponse`                                      |
| Document         | `root.tsx`, `Meta`, `Links`, `Scripts`           | explicit `Document` module with `<head>` and asset entry                                      |
| Page UI          | React function components                        | Remix `Handle<Props>` modules and render closures                                             |
| Styling          | Tailwind utility classes                         | preserve the visual tokens; translate to `remix/ui` `css()` mixins or a static app stylesheet |
| URL navigation   | `useSearchParams` and React Router `Link`        | generated route hrefs, real anchors, and a GET form                                           |
| Combobox         | React hooks across the page runtime              | a single serializable `clientEntry` island                                                    |
| Metadata filters | hydrated button callbacks                        | ordinary anchors generated from the existing pure URL helpers                                 |
| Database         | Drizzle over D1                                  | unchanged implementation, injected through middleware                                         |
| Worker           | `createRequestHandler` + virtual server build    | thin adapter calling `router.fetch(request)`                                                  |
| Browser boot     | React hydration + hydrated router                | one Vite client entry calling `run()` when supported                                          |
| Tests            | Vitest plus Workerd pool                         | Remix router/pure tests plus Workerd D1/Worker integration tests                              |

## Proposed target layout

```text
app/
  actions/
    controller.tsx          # GET/HEAD home and explicit responses
    search-page.tsx         # route-owned server-rendered page
  assets/
    entry.ts                # Remix browser runtime bootstrap
    search-controls.tsx     # the only initially hydrated module
  data/
    database.ts             # createDatabase and AppDatabase type
    search.ts               # existing faceted query implementation
    schema.ts               # existing Drizzle schema
  middleware/
    database.ts             # typed D1/Drizzle context injection
    render.tsx              # request-scoped streaming renderer
  ui/
    document.tsx            # explicit HTML document
    results-navigation.tsx  # shared only if reuse is real
    video-card.tsx
  utils/
    normalize.ts
    search-params.ts        # current pure URL/filter state
  client-entry.ts           # source/public client-entry mapping
  router.ts                 # middleware and controller composition
  routes.ts                 # typed public URL contract
workers/
  app.ts                    # Cloudflare adapter only
```

This is a destination map, not a requirement to move every file before behavior
works. Route-owned UI should start beside the root controller and only move to
`app/ui` when reuse is demonstrated.

## Important module seams

### Faceted search

`loadSearchPage(db, request)` is already the deepest useful application module:
one interface hides filter scoping, option counts, pagination, result mapping,
and metadata lookup. Keep it intact and test through that interface.

Do not add a generic repository interface just because the framework changes.
The production and test paths both exercise D1, and there is no second database
adapter. Drizzle can remain an implementation detail inside the data module.

### URL state

The pure search-parameter functions are a valuable seam. They should remain
framework-independent and become the single source for:

- form/query parsing;
- card-filter hrefs;
- pagination hrefs;
- client-entry navigation.

The only likely adjustment is to prefix generated query strings with
`routes.home.href()` rather than relying on `"."`.

### Cloudflare runtime

The Worker should know about Cloudflare bindings and failure logging. Search UI
and data-shaping modules should not. A middleware context key can expose the
Drizzle database to the controller while the Worker remains the adapter that
provides D1.

Avoid adding sessions, CSRF, form parsing, or auth middleware: Tango has no
mutations or identity state, so those would be unused seams.

## Browser ownership and progressive enhancement

The current page hydrates the React Router tree even though only a subset of
behavior needs browser state. Remix 3 allows a narrower design:

1. Render result cards, pagination, reset, and metadata filter changes as real
   links or a GET form.
2. Render useful search controls without JavaScript, initially with native
   selects if necessary.
3. Hydrate only the searchable combobox controls.
4. Keep combobox props serializable: current filters and option arrays.
5. Let the island navigate to a URL produced by the same pure search-parameter
   module used by the server.

This preserves deep links, reloads, browser history, and shareability while
reducing browser ownership. It also localizes the main porting risk: the
285-line hook-based combobox needs a deliberate Remix UI rewrite, while video
cards and pagination do not.

## Migration sequence

### Phase 0: lock the comparison

- Record the current route, query parameters, visible states, and representative
  result/filter interactions.
- Run the existing test suite and capture a small set of rendered-page checks
  once dependencies are installed in this worktree.
- Treat the current D1 tests as the semantic baseline.

### Phase 1: server-only vertical slice

- Add `remix@3.0.0-beta.5` and switch the TypeScript JSX source to `remix/ui`.
- Define typed `GET /` and `HEAD /` routes.
- Add the database and render middleware.
- Add a root controller that parses the existing query string, calls the
  existing `loadSearchPage`, and returns a complete streamed document.
- Port the page, video cards, and pagination with real anchors.
- Use a native GET form for a temporary but functional no-JavaScript filter UI.
- Replace Radix React icon modules with small app-owned SVG Remix UI modules.

Exit criterion: all search and pagination behavior works with JavaScript
disabled and the existing D1 semantics are unchanged.

### Phase 2: focused interactive controls

- Port the combobox as one Remix `clientEntry`.
- Add a fixed Vite client bundle and a small `resolveClientEntry` map following
  the bookshelf reference.
- Boot Remix UI with `run()` behind the required Navigation API feature check.
- Preserve focus restoration, arrow-key navigation, escape behavior,
  outside-click dismissal, responsive panel placement, and option counts.
- Keep metadata filters and pagination as anchors rather than hydrating the
  result grid.

Exit criterion: the current interaction quality is restored without hydrating
the whole document.

### Phase 3: Cloudflare cutover

- Remove the React Router Vite plugin, route type generation, React entry files,
  and virtual server build.
- Make `workers/app.ts` call the Remix router directly.
- Keep D1 and observability configuration; align Static Assets with the local
  Remix references.
- Keep `scripts/update-cloudflare-db.ts` and the import contract unchanged.
- Verify local Vite dev, built Worker preview, and preview-environment bindings.

Exit criterion: development, preview, and production builds use the same
Cloudflare-oriented request path.

### Phase 4: verification and cleanup

- Preserve pure URL-state tests.
- Preserve the Workerd-backed faceted-search tests.
- Add router tests for `GET`, `HEAD`, 404, and representative query strings.
- Add a component/browser test for combobox keyboard and focus behavior.
- Compare rendered output and mobile/desktop screenshots with the current app.
- Only then remove React, React DOM, React Router, `@react-router/dev`, `isbot`,
  and Radix React icons.

## Risks and open choices

### Remix 3 is still beta

The local references are pinned to beta.5. Pin Tango to the same version for
the first port rather than mixing a moving framework version with an
architectural comparison. Upgrade in a separate change after parity.

### Client-entry build integration

R3Faster needed a custom manifest bridge because it has multiple source-owned
client entries. Tango should start with the simpler bookshelf pattern: one
fixed browser entry file and one known exported client component. Adopt the
R3Faster manifest bridge only if a second independently built entry makes the
seam real.

### Styling strategy

The reference apps use `remix/ui` `css()` mixins; Tango uses Tailwind. The first
vertical slice should preserve the current visual tokens and layout, not retain
Tailwind at any cost. A short spike should compare:

- translating route-owned styles to colocated `css()` mixins; and
- emitting the current Tailwind result as a static stylesheet.

The decision criterion is maintainability and visual parity, not minimizing the
package diff.

### Page-level caching

Every filtered URL is shareable and read-only, so explicit browser/edge caching
may be useful. It is not required for the port and should follow measurement.
The D1-backed response varies by query string but not by user, which makes
cache policy straightforward once database refresh invalidation is defined.

### Query cost

The page currently performs nine facet/count/metadata queries in parallel and a
tenth result query after page clamping. That is existing behavior, not a Remix
regression. Measure it during parity testing; optimize separately so framework
translation and query-plan changes are not conflated.

## Recommended first implementation slice

Implement only the server-owned `GET /` path first:

1. typed route;
2. D1 middleware;
3. root controller;
4. streamed document;
5. existing `loadSearchPage`;
6. video cards and pagination as anchors;
7. native GET filter form;
8. router and Workerd tests.

That slice answers the core architectural question with running code while
leaving the combobox rewrite as an isolated, evidence-backed second step.
