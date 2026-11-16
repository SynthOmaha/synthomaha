# synthomaha.net

synth night in Omaha

[![Netlify Status](https://api.netlify.com/api/v1/badges/48146f69-e891-405d-83a7-c981680f79e9/deploy-status)](https://app.netlify.com/projects/synthomaha/deploys)

<a href="https://github.com/taraxvoid/voidflow">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/CI-voidflow-8b8fd9?labelColor=2b2d3a&style=flat">
    <img alt="CI: voidflow" src="https://img.shields.io/badge/CI-voidflow-5a5fb8?labelColor=3a3d4d&style=flat">
  </picture>
</a>

## Dependencies

- A working \*nix shell
- [Bun](https://bun.sh/) as drop-in Node interpreter replacement, package manager and test runner
- (optional) [mise](https://mise.jdx.dev/) for node ver wrangling (see `mise.toml`)
- (optional) [Netlify CLI](https://docs.netlify.com/cli/get-started/) for managing the `synthomaha.net` deployment
- (optional) [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (a devDependency, `bunx wrangler`) for the Cloudflare deployment

## Stack

- [Astro](https://astro.build/) - static site generator
- [Decap CMS](https://decapcms.org/) - content management
- [Biome](https://biomejs.dev/) - lint

## One-time Setup

Get deps

> bun install

Link to your netlify project

> netlify link

## Build and preview locally

- `bun run dev` - Start local dev server
- `netlify deploy` - Generate a preview deploy

PRs against `main` will build a preview server on Netlify (details in the netlify bot's comment which is created on the PR)

## Deploy to Production

Hosting is migrating from Netlify to Cloudflare
([#109](https://github.com/SynthOmaha/synthomaha/issues/109)). Merges to
`main` deploy to both:

- **Netlify** (`synthomaha.net`): auto-deploys from its git integration.
  `netlify deploy --production` to deploy manually.
- **Cloudflare** (`synthnight.com`, trial): CI's `deploy` job runs
  `wrangler deploy --env prod` after validation passes. To deploy manually,
  `PUBLIC_TURNSTILE_SITE_KEY=<site key> bun run deploy` (it builds first and
  refuses to run without the key). `bunx wrangler rollback --env prod` to roll back.

### Mailing list signup on Cloudflare

On Netlify the signup form uses Netlify Forms. On Cloudflare the Worker
(`src/worker.ts`) handles `POST /api/signup`: it verifies a Turnstile token,
then emails the signup to the list owner through Resend. Nothing is stored.

One-time setup:

- Create a Turnstile widget whose hostnames include `synthnight.com` and
  `synthomaha.net`. `TURNSTILE_HOSTNAMES` in `wrangler.jsonc` must list the same
  hostnames, since the Worker rejects tokens issued for any other.
- Set the repo variable `TURNSTILE_SITE_KEY` (public). The deploy job passes it
  to the build as `PUBLIC_TURNSTILE_SITE_KEY`, which switches the form to the
  Worker. Without it the form uses Netlify Forms.
- Set the Worker secrets: `bunx wrangler secret put RESEND_API_KEY --env prod`
  and `bunx wrangler secret put TURNSTILE_SECRET --env prod`.
- Verify `synthnight.com` in Resend. `RESEND_FROM` in `wrangler.jsonc` must use
  an address on a verified domain (`signup@synthnight.com`), and `RESEND_TO` is
  the inbox that receives each signup (`contact@synthnight.com`). Subscribers
  are set as `reply_to`, so replying to a signup email writes to them.

## License

Source code is licensed under the [MIT License](LICENSE). Content (images,
photos, logos, event and musician text under `public/` and `src/content/`) is
not covered by it and is not available for reuse. My content (site copy,
logo, favicons) is excluded and all rights reserved. See [NOTICE](NOTICE).
