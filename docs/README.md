# Documentation

For club members, developers, and AI agents working on the Ventorelativo site.

| Document                                     | Read it when                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [how-to.md](how-to.md)                       | You want to change something: text, a nav item, a colour, a page, an image. Start here.                                |
| [architecture.md](architecture.md)           | You want to understand how the site is built, or you are about to change how something works rather than what it says. |
| [verifying-changes.md](verifying-changes.md) | You have made a change and want to know it actually works. Includes the measurement tool and the known traps.          |
| [performance.md](performance.md)             | Before adding any library, and whenever a page gets heavier. The site targets 100/100 in PageSpeed Insights.           |
| [../AGENTS.md](../AGENTS.md)                 | You are an AI agent, or you want to see the rules one is given.                                                        |
| [../MIGRATION-PLAN.md](../MIGRATION-PLAN.md) | You want the full scope of the Drupal → Astro migration, the decisions behind it, and what each phase covers.          |

## Working with an AI agent on this site

The repository is set up so any mainstream coding agent picks up its instructions
automatically: [`AGENTS.md`](../AGENTS.md) is the cross-vendor standard file, and
`CLAUDE.md` and `.github/copilot-instructions.md` point at it rather than
repeating it.

You do not need to explain the project each time. Useful things to say instead:

- **Name the goal, not the implementation.** "Add a page about the club's school
  at /scuola, in the same style as the others" gets a better result than
  describing files.
- **Ask it to verify.** "Run `npm run verify` and measure the page at 390x844 and
  1440x900 in both colour schemes." The instructions already require this, but
  asking makes it explicit.
- **Ask what it changed and why** before merging. Every file in this repo
  explains its own decisions in comments; hold new code to the same standard.
- **Content in Italian, code and comments in English.**

If an agent proposes adding a dependency, a CSS framework, a dark-mode block, or
changing URLs — those are all things the instructions forbid for concrete
reasons. Ask it to justify against [`AGENTS.md`](../AGENTS.md) before agreeing.

## Current state

Phases 1 and 2 are complete: the design system, all the content, every URL the
old site had, the SEO layer, and a CMS that runs locally (`npm run dev`, then
<http://localhost:4321/keystatic>).

The repository is still **local only** — no GitHub remote, no deployment, and the
live site is still the Drupal one. Phase 3 adds the remote, moves the CMS to
GitHub so the club can edit from a browser, and turns on automatic deploys;
Phase 4 brings the maps and flight data; Phase 5 switches the domain.
[`MIGRATION-PLAN.md`](../MIGRATION-PLAN.md) §7 tracks all of it.
