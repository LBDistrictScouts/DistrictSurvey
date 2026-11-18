# district-survey

A React app built with [Next.js](https://nextjs.org) and exported as a static site.

## Getting started

This project uses Yarn through Corepack. The version is pinned in `package.json`.

```bash
corepack enable
```

```bash
yarn install
```

```bash
yarn dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command          | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `yarn dev`       | Start the development server             |
| `yarn build`     | Export the static site to `out/`         |
| `yarn lint`      | Run ESLint                               |
| `yarn typecheck` | Check types with the TypeScript compiler |

## Deployment

Run `yarn build` and upload the contents of `out/` to any static file host.
