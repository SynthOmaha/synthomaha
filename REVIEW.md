# Code Review Guide

A checklist for reviewing changes to **synthomaha.net** - an Astro + React + Tailwind CSS static site.

## Quick Checks

- [ ] PR has a clear description and links any related issues.
- [ ] Changes are scoped to the smallest reasonable diff.

## Automated Checks (run locally before merging)

```bash
bun run lint        # Biome lint + format
bun run check       # Astro + TypeScript type checking
bun run test:unit   # Vitest unit tests
bun run test:build  # Build-output snapshot tests
bun run test:ical   # iCal feed tests
bun run test:data   # Content/data consistency tests
bun run test:e2e    # Playwright e2e (requires build)
bun run build       # Full production build
```

The full suite is `bun run test` (builds once, then runs check, unit, and e2e in parallel).

## Code Style

Enforced by Biome (`./biome.json`). Run `bun run format` to auto-fix.

- 4-space indentation, LF line endings, 80-column width.
- Single quotes; double quotes for JSX attributes (`jsxQuoteStyle: "double"`).
- Trailing commas; semicolons only where needed (`"asNeeded"`).
- Arrow functions always parenthesized (`"always"`).
- Unused imports/variables are errors in TS/TSX. In `.astro` files they are tolerated (lint override), but clean them up anyway.
- Imports are auto-ordered (`organizeImports: "on"`).

## Astro / Content Collection Changes

- [ ] If adding or changing an entry in `src/content/events/` or `src/content/musicians/`, the Zod schema in `src/content.config.ts` validates the shape. Add fields there first.
- [ ] New content collection fields get sensible defaults so existing entries don't break.
- [ ] Run `bun run check:content` (Astro sync) after schema changes so `dist/` and types stay in sync.
- [ ] `.astro` components: prefer Astro for static content; use React (`<... />`) only when interactivity is needed (forms, stateful widgets).
- [ ] `client:load` / `client:idle` / `client:visible` directives are intentional and documented - don't hydrate unnecessarily.

## React Components

- [ ] Forms degrade gracefully (the static fallback form still works without JS).
- [ ] Client-side errors are surfaced inline, not via `alert()`.
- [ ] No host-specific form handling (Netlify Forms etc.): the site is served from both Netlify and Cloudflare during the migration (#109).

## Styling (Tailwind CSS v4)

- [ ] Uses the Webawesome component library (`@awesome.me/webawesome`) where appropriate.
- [ ] Does not introduce raw CSS that could be expressed via Tailwind utilities.
- [ ] Color palette follows `src/styles/` tokens; don't hardcode colors.

## Accessibility

- [ ] Images have descriptive `alt` (or `alt=""` if purely decorative).
- [ ] Interactive elements are keyboard-navigable.
- [ ] Color contrast meets WCAG AA.
- [ ] Form labels are associated with inputs (`for` / `id` pairing).

## Performance

- [ ] Images use `loading="lazy"` and appropriate `width`/`height` or `aspect-ratio` to avoid layout shift.
- [ ] No new blocking scripts in `<head>` beyond what Tailwind/JSX already needs.
- [ ] `bun run generate` is re-run if `src/styles/logo.svg` or favicon sources change.

## Security

- [ ] No secrets, tokens, or credentials committed - check the diff for hardcoded values.
- [ ] No `eval()` or `innerHTML`.
- [ ] `Markdown.astro` renders content via Astro's `set:html={html}` after `marked` + `marked-shiki` processing. Ensure `content` sources (e.g. content collections) are trusted/sanitized since `set:html` bypasses escaping.

## Testing

Unit tests cover new logic in `src/utils/` and any content-driven behavior. Key test files:

- `test/recurrence.test.ts` - `rrule` date logic.
- `test/ical.test.ts` - iCal feed generation and validation.
- `test/data.test.ts` - content consistency (orphaned entries, broken references).
- `test/build.test.ts` - `dist/` output snapshot checks.
- [ ] E2e tests cover any new user-facing flow (forms, calendar subscribe).

## Deployment

- [ ] `bun run build` succeeds and `dist/` looks correct.
- [ ] Preview deploy passes on Netlify (the Netlify bot posts a deploy URL on PRs).
- [ ] `wrangler.jsonc` changes dry-run cleanly: `bun run build && bunx wrangler deploy --env prod --dry-run`.

---

When in doubt, run the linter/formatter and ask: "Does this change increase complexity without a clear benefit?"
