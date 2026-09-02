# Deploying, and the CMS that comes with it

Phase 3. Two things arrive together, because one needs the other: the site
starts deploying to Netlify, and Keystatic starts writing to GitHub instead of
to a working copy. The admin needs two server-rendered routes, which is why the
Netlify adapter — banned until now — is allowed from this phase on.

## The shape of it

```
club member edits at /keystatic
        │  Keystatic commits through the GitHub API
        ▼
github.com/ventorelativo/ventorelativo-astro   (main, or a branch)
        │  Netlify sees the commit
        ▼
npm run build → dist/  →  deployed
```

Nobody needs a checkout, a terminal or a merge. Who may edit is decided by
GitHub: write access to the repository, and nothing else.

## Which Netlify project

There are two, on purpose.

| Project               | URL                | What it is                                       |
| --------------------- | ------------------ | ------------------------------------------------ |
| `ventorelativo`       | `ventorelativo.it` | The **live** Drupal/Tome export. Leave it alone. |
| `ventorelativo-astro` | `*.netlify.app`    | This build, while it is being finished.          |

The domain moves to the new project at go-live (Phase 5), once the Phase 4
flight data has been diffed against the archive. Repointing it earlier would
put an unfinished site in front of the club for no gain — and the old project
keeps serving from its own deploy until we say otherwise.

## Steps only a human can do

### 1. Create the Netlify project

Netlify → **Add new project** → **Import an existing project** → GitHub →
`ventorelativo/ventorelativo-astro`.

| Setting           | Value                 |
| ----------------- | --------------------- |
| Project name      | `ventorelativo-astro` |
| Branch to deploy  | `main`                |
| Build command     | `npm run build`       |
| Publish directory | `dist`                |

The build command and publish directory are already in `netlify.toml`, so the
form should prefill them; if it does not, they are the values above. Leave
branch deploys enabled — that is what gives an editor a preview of their own
branch. Note the URL it hands you.

### 2. Let Keystatic create its GitHub App

`keystatic.config.ts` is already in GitHub mode, so:

```
npm run dev
```

Open <http://localhost:4321/keystatic>. It shows a **Keystatic Setup** screen
rather than the editor, because the app does not exist yet. Fill in:

- **Deployed App URL** — the Netlify URL from step 1.
- **GitHub organization** — `ventorelativo`.

Click through to GitHub, name the app (`ventorelativo-cms` reads well), create
it, then **install it on the `ventorelativo-astro` repository**. Creating an app
and installing it are two separate acts; skipping the second leaves the CMS
authenticated but unable to see the repo.

Keystatic writes the credentials into `.env` for you. Four values:

| Variable                           | What it is                         |
| ---------------------------------- | ---------------------------------- |
| `KEYSTATIC_GITHUB_CLIENT_ID`       | the app's identity                 |
| `KEYSTATIC_GITHUB_CLIENT_SECRET`   | its password — a real secret       |
| `KEYSTATIC_SECRET`                 | signs the editor's session cookie  |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | the app's URL name; safe to expose |

`.env` is git-ignored and must stay that way. The repository is public.

### 3. Copy the four values into Netlify

Project → **Site configuration** → **Environment variables** → add all four,
exactly as `.env` has them. The deployed admin cannot authenticate without them,
and there is no error message that says so plainly — it simply shows the setup
screen again.

## What editing looks like afterwards

An editor opens `/keystatic` on the deployed site, logs in with GitHub, and
edits. Saving commits. If Keystatic is configured with a branch prefix they work
on a branch, Netlify builds a preview of it, and merging publishes — otherwise a
save goes straight to `main` and the site rebuilds within a couple of minutes.

Each collection carries a `previewUrl`, so an entry has a **Preview** link
pointing at that branch's deploy rather than at production.

## Local development after this change

`npm run dev` still serves the admin, but it now reads and writes **GitHub**, not
your files. A save from localhost is a real commit. To edit files without
touching the repository, edit the MDX under `src/content/` directly.
