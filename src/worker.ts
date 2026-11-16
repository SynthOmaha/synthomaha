import { handleSignup, type SignupEnv } from './lib/signup'

interface Env extends SignupEnv {
    ASSETS: { fetch(request: Request): Promise<Response> }
}

// Static assets are served by the platform without invoking this Worker
// (see `assets.run_worker_first` in wrangler.jsonc). Only /api/* lands here.
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const { pathname } = new URL(request.url)
        if (pathname === '/api/signup') return handleSignup(request, env)
        if (pathname.startsWith('/api/')) {
            return new Response('Not found', { status: 404 })
        }
        return env.ASSETS.fetch(request)
    },
}
