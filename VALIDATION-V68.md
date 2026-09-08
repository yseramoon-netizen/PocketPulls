# V68 validation record

Executed on 7 September 2026 in the supplied workspace. Production credentials were not used.

| Check | Result |
| --- | --- |
| Production Webpack build | Passed; TypeScript completed and 59/59 static pages generated |
| Behavioural regression suite | 26 passed, 0 failed |
| Source release preflight | 82 passed, 0 failed; deployment-environment validation intentionally not run |
| Performance budget audit | Passed; no route, server-chunk or public-asset budget violations |

The behavioural tests exercise URL filter round trips and invalid input, merged navigation destinations, serial/coalesced writes, account-scoped wish recovery after reload, storage denial, scanner agreement/identity rejection, the earlier Trumbeak recognition case, aborted recognition and inventory API input rejection. They are offline tests with isolated network substitutes, not live Supabase or camera tests.

## Initial JavaScript transfer

Measured gzip estimates from the production build. The budget is 270 KiB per initial route.

| Route | V67.16 snapshot | V68 |
| --- | ---: | ---: |
| `/wishes` | 234.6 KiB | 238.5 KiB |
| `/collection` | 236 KiB | 240.1 KiB |
| `/constellation` | 244.8 KiB | 248.3 KiB |
| `/wishes/preview` | 257.5 KiB | 262.3 KiB |
| `/admin/add` | 245.9 KiB | 249.3 KiB |

The new shared functionality adds a few KiB to the initial bundles. This release reduces repeated requests and rendering work; it does not claim a smaller download or a measured real-device FPS improvement. The heaviest route is still within budget.

## Not executed here

Authenticated mobile/browser walkthroughs, physical-camera throughput and accuracy, real-account wish recovery, live inventory concurrency, shipping mutations, payments and production-environment checks. These require the actual deployment and corresponding access. Use the existing release checklist and scanner diagnostic export for those checks.

No database, deployment, paid order or live stock record was changed. The full app was not declared lint-clean: the inherited repository has lint debt, and this release uses the production TypeScript build plus targeted behavioural regressions as its executed automated checks.

Raw outputs are included in `validation-v68/`.
