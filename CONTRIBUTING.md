# Contributing to Quran Web

Thank you for helping make the Quran easier to read in Thai. This guide covers how to report problems, set up the project, and open a good pull request.

## Ways to help

- **Translation errors** — use the report button on a verse at [read.quran.in.th](https://read.quran.in.th). Translation fixes themselves are reviewed through the contributor panel (`quran-admin`), not through this repo.
- **Bugs** — open an issue with the page URL, device/browser, and steps to reproduce. Screenshots help.
- **Features and fixes** — open an issue first for anything larger than a small fix so we can agree on the approach.

## Local setup

Requires Node.js 20+.

```bash
git clone git@github.com:quran-th/quran-web.git
cd quran-web
npm install
cp .env.example .env
npm run dev          # http://localhost:3000
```

The reader needs `quran-api` running at `http://localhost:8787` (the `.env.example` default). Run it from the sibling `quran-api` repo with `npm run dev`.

Before you push:

```bash
npm run lint
npm run build
```

A pre-commit hook (Husky + lint-staged) runs `eslint --fix` on staged `.ts` and `.vue` files.

## Workflow

1. Branch from `main`: `feat/short-name` or `fix/short-name`.
2. Keep each PR focused on one change.
3. Check the change in the browser at both a desktop and a mobile width. This is a reading app used mostly on phones.
4. Open a PR against `main` and describe what changed and why. Add screenshots for UI changes.

## Commit messages

Releases are automated by semantic-release from [Conventional Commits](https://www.conventionalcommits.org). Your commit type decides the next version:

| Prefix | Effect |
|--------|--------|
| `fix:` | patch release |
| `feat:` | minor release |
| `feat!:` or a `BREAKING CHANGE:` footer | major release |
| `docs:`, `chore:`, `refactor:`, `test:` | no release |

Example: `fix: start ayah 1 inside its measured quiet`

Do not edit `CHANGELOG.md` or the `version` in `package.json` by hand; the release bot owns them.

## Code style

- **Tailwind first.** Use utility classes; write custom CSS only for things Tailwind cannot express (complex animations, pseudo-elements).
- **TypeScript** for all new code; no `any` where a type is easy to give.
- **Comments only for business logic**: non-obvious decisions, domain rules, workarounds. Don't narrate obvious code, and don't leave change-log comments, since git history records changes.
- **Thai UI text** lives in `i18n/locales`, not inline in components.
- Follow the existing structure: pages in `app/pages`, reusable UI in `app/components`, state in `app/stores`.

## Quran text and translations

Accuracy matters more than anything else here.

- Never edit Arabic text, translations or audio timings by hand in this repo; they come from `quran-api` and the asset CDN.
- Be careful with the Mushaf glyph fonts (QCF): page fonts are loaded per page, and a wrong page number shows wrong glyphs.
- If a change touches recitation or Thai translation audio, say so in your PR so it can be checked by ear.

## Questions

Open a GitHub issue and we'll help you get started.
