# Bumping the app version

When you release a new version (bugfix, feature, etc.), update **every place below** so the UI, tooling, and npm metadata stay aligned.

Use [Semantic Versioning](https://semver.org/) when you pick the number: `MAJOR.MINOR.PATCH` (e.g. `1.2.2` → `1.2.3` for a patch).

## Checklist (edit these files)

| # | File | What to change |
|---|------|----------------|
| 1 | [`package.json`](../package.json) | Top-level `"version": "x.y.z"`. |
| 2 | [`package-lock.json`](../package-lock.json) | **Only** the root package version in **two** spots (see below). Do **not** search-and-replace other `1.2.x` strings in this file—they belong to **dependencies**, not your app. |
| 3 | [`src/environments/environment.ts`](../src/environments/environment.ts) | `version: 'x.y.z'` |
| 4 | [`src/environments/environment.prod.ts`](../src/environments/environment.prod.ts) | `version: 'x.y.z'` |
| 5 | [`src/environments/environment.local.ts`](../src/environments/environment.local.ts) | `version: 'x.y.z'` |
| 6 | [`src/app/core/constants/app.constants.ts`](../src/app/core/constants/app.constants.ts) | `VERSION: 'x.y.z'` (used by layout/footer and auth UI). |

## `package-lock.json` (root only)

Update **only** these entries to match `package.json`:

1. Near the top of the file: the root object has `"name": "ettad-frontend"` and `"version": "..."`.
2. Inside `"packages"`, the entry with key `""` (the workspace root): same `"version": "..."`.

After editing `package.json`, you can instead run:

```bash
npm install --package-lock-only
```

That refreshes the lockfile’s root version from `package.json` without reinstalling all modules (optional; manual edits to those two fields are fine).

## What you do **not** need to edit

- [`environment.interface.ts`](../src/environments/environment.interface.ts) — only declares the `version` field type.
- Components that **read** `APP_CONSTANTS.VERSION` or `environment.version` — they pick up changes automatically once constants and environments are updated.

## Git tag and CI

GitLab builds release artifacts from **git tags**, not from these strings. After merging your version bump, create a tag that matches your release naming (e.g. `v1.2.3`) and push it so CI can run.

These in-repo strings are mainly for **display**, **support**, and **npm** metadata.
