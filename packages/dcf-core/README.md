# @textcat/dcf-core

Shared valuation core package extracted from `dcf-valuation`.

## Included
- DCF engine (`calculateDCF`)
- Layer B / Layer C validation engines
- Monte Carlo simulation
- Industry benchmark mapping
- Financial/valuation TypeScript types
- `createPrefilledDCFInputs(financialData, waccInputs)`

## Build
```bash
npm install
npm run build
```

## Publish to GitHub Packages (manual)
1. Configure npm auth for GitHub Packages.
2. Bump version in `package.json`.
3. Publish:
```bash
npm publish --access restricted
```

`publishConfig.registry` is set to `https://npm.pkg.github.com`.
