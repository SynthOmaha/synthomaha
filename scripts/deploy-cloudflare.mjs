// Manual Cloudflare deploy: build with the Turnstile site key, then
// `wrangler deploy --env prod`. Without the key the build ships the Netlify
// Forms variant of the signup form, which nothing on Cloudflare handles.
// CI deploys through voidflow's cloudflare-deploy action instead.
import { spawnSync } from 'node:child_process'

if (!process.env.PUBLIC_TURNSTILE_SITE_KEY) {
    console.error(
        'PUBLIC_TURNSTILE_SITE_KEY is not set; refusing to build a signup form that cannot work on Cloudflare.',
    )
    process.exit(1)
}

for (const [cmd, ...args] of [
    ['bun', 'run', 'build'],
    ['bunx', 'wrangler', 'deploy', '--env', 'prod', ...process.argv.slice(2)],
]) {
    const { status } = spawnSync(cmd, args, { stdio: 'inherit' })
    if (status !== 0) process.exit(status ?? 1)
}
