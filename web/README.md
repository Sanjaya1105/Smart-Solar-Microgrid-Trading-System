# Solargrid frontend

The frontend is organized by responsibility. `src/App.tsx` coordinates authentication, active pages and dialogs. Screens live in `src/pages`, the sidebar/header in `src/layouts`, forms and QR/map widgets in `src/components`, session/data loading in `src/hooks`, shared contracts in `src/types`, and display helpers in `src/utils`.

`src/api.ts` remains the shared HTTP client. `src/reservationViews.ts` contains booking filters. `src/Management.tsx` preserves the old exports for compatibility; implementations now live in the page/component folders. Navigation still uses React page state, with API role enforcement on the server.

See [the Sinhala structure and updated Member 1 flow guide](../docs/FRONTEND_STRUCTURE_SI.md).

Run `npm run dev`, `npm run build`, `npm run lint`, and `npm test` from this folder. Run `npx playwright test tests/browser/frontend-pages.spec.ts --timeout=30000` for the isolated API-fixture page regression checks. The separate management browser test requires the disposable API environment described in `tests/verify_api.py`.

## Original tooling notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
