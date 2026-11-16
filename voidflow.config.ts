// Per-repo voidflow config: what voidflow manages for this repo. Plain data, no
// secrets. Read by `voidflow plan|check|apply rulesets`
export default {
    kind: 'site',
    cloudflare: {
        account: '305f9a617cbd47585f6c122f9ca166d0',
        adminTokenEnv: 'CF_TOKEN_ADMIN',
    },
}
