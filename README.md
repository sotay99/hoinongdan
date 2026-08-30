# quanlycongtachoinongdan

The static application entry point is `index.html`. Deployable styles are kept
in `public/assets/css/`, and classic browser scripts are kept in
`public/assets/js/`; their root-relative URLs also work on `/bienlai/<code>`
routes. Filenames include a SHA-256 content prefix, so deployed assets can be
cached immutably while the HTML remains revalidated.

Run the built-in-only local validation before deployment:

```sh
node scripts/validate-static.js
```

Firebase Hosting runs this validation through its `predeploy` hook. The
existing deployment workflow copies `index.html` to both `public/` and
`functions/`; the tracked `public/assets/` directory deploys unchanged.
