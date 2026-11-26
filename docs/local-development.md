# Local development

Everything runs on one laptop, with no AWS account.

## The site alone

```bash
yarn dev
```

This writes example build data from `examples/` and serves the site on port 3000. The survey window in the example
is March 2027, so the survey pages say it has not opened yet. Set your clock, or edit `opensAt` in
`examples/settings.example.yaml`, to answer it.

## The site with the APIs

The local Lambda server runs the real Lambda code. It uses DistrictWorkflow's Moto on port 4566, shared with
DistrictWorkflow's own local stack:

```bash
(cd ../DistrictWorkflow && corepack yarn aws:local:up)
yarn dev:all
```

`yarn dev:all` starts:

| Port | What |
| --- | --- |
| 3000 | `next dev`, calling the APIs on 8787 |
| 8787 | `functions/local/server.ts`: both Lambdas, standing in for API Gateway and adding CloudFront's origin header |
| 8788 | `functions/local/results-proxy.ts`: results cookies, checked the way CloudFront checks them |

On first start the server writes `.local/local.secrets.json` with fresh keys, and creates its buckets, queues and
control parameters in Moto. To run without Moto, set `LOCAL_STORE=memory`.

Useful settings for the local server:

| Variable | Effect |
| --- | --- |
| `LOCAL_STORE=memory` | Keep records in memory instead of Moto |
| `LOCAL_NOW=2027-03-14T12:00:00Z` | The Lambdas' clock, so the example survey is open |
| `TURNSTILE_VERIFY_URL=http://localhost:8787/__local/siteverify` | Skip Cloudflare. `LOCAL_TURNSTILE=fail` rejects every token |

## A tracked link

`scripts/sign-test-link.ts` stands in for DistrictWorkflow's invitations:

```bash
yarn tsx scripts/sign-test-link.ts --env local
```

It prints an invite UUID and a link. Completion messages go to the Moto queue; read them with
`yarn tsx scripts/read-test-queue.ts --env local`, or see them at `http://localhost:8787/__local/messages`.

## The exported site

To test the real export, as the browser tests do:

```bash
yarn build
LOCAL_STORE=memory LOCAL_NOW=2027-03-14T12:00:00Z yarn tsx functions/local/server.ts --static out
```

Then open `http://localhost:8787`. The server applies the same Content Security Policy as CloudFront.

## Resetting

`yarn test:reset --env local` empties the local buckets and queues and switches every control back on.

## Moto and conditional writes

The design asks Phase 2 to confirm that Moto supports conditional S3 writes (`If-None-Match: *`). The record code
in `functions/shared/s3-records.ts` depends on them. `yarn test:stack` runs the browser tests against Moto; if
Moto returns success for a second conditional write, the tracked-link tests fail, and LocalStack is the fallback.
