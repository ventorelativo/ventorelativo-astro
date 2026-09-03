# Writing content with an AI

Volunteers write the club's news posts. Some of them would rather start from a
draft than from a blank box, and every one of them already has a free ChatGPT or
Gemini account. This is the kit that lets them do it without the site's rules
getting lost on the way.

The whole feature is **a document and a copy button**:

| Piece                         | What it is                                                                 |
| ----------------------------- | -------------------------------------------------------------------------- |
| `src/authoring/istruzioni.md` | The contract. Italian, one section per content type, the only source.      |
| `src/lib/authoring.ts`        | Slices it on its `blocco:` markers and builds the prompt.                  |
| `/redazione`                  | The page a volunteer copies from. `noindex`, out of the sitemap.           |
| `/redazione/istruzioni.txt`   | The same document as plain text, at a stable address.                      |
| `scripts/check-authoring.mjs` | Fails the build when the document and the schemas disagree.                |
| `scripts/check-content.mjs`   | Fails the build on an em dash, which is the rule a model breaks by reflex. |

A volunteer copies the prompt for what they are writing, pastes it into whatever
chat they use, adds their raw notes underneath, and gets back a value for every
field plus a list of what the model could not fill. They type those into
Keystatic themselves. Nothing is automated, nothing is published without a
person reading it, and no key or account is involved.

## Why not WebMCP

The site already registers tools for a visitor's AI assistant
(`src/lib/webmcp.ts`), so the question comes up: could an editor's assistant
call a `create_news_post` tool?

Not usefully, and not for this. WebMCP puts the agent **inside the browser**:
it needs `document.modelContext`, which is a W3C Community Group draft that
Chrome has renamed once already, and it needs an agent in that browser speaking
it. ChatGPT open in another tab is not that agent, and a free tier certainly is
not. The audience for such a tool today is approximately no editors.

The deeper reason is that nothing here needs executing. What a volunteer needs
is a briefing: the rules, their notes, and an answer. A document delivers that
on every model, on every tier, with no browser support and nothing installed.

The version that would make sense one day is the `/keystatic` page itself
registering tools so an in-browser agent fills the form. It needs a browser
almost nobody has and Keystatic's React form state to be drivable from outside,
which it is not. Recorded here so it is not re-proposed as new.

A server-side MCP server, or calling a model API from a Netlify function, was
rejected for a different reason: it costs money per use and needs a key the club
would have to hold and rotate. Copy and paste costs nothing and breaks nothing.

## Why the instructions are in Italian

Rule 10 puts documentation in English, and this is the exception, deliberately.
Its readers are the volunteer who skims it and the model that follows it, not a
developer. An Italian brief also nudges an Italian answer, which is what the
site needs. English stays where it belongs: the field **keys** are English
because they are the real keys, with the Italian Keystatic label beside each so
a volunteer can match a value to the box it goes in.

## Why the document is sliced

A free tier has a small context window and quietly drops instructions once it
fills. Someone writing a news post has no use for the flight-site rules, so the
copy button ships the common section plus one type. The `<!-- blocco:… -->`
markers in the markdown are the seams, and `src/lib/authoring.ts` throws at
build time if one goes missing: a contract that silently omits a rule is worse
than no contract.

## Why the URLs are placeholders

`{{keystatic}}` and `{{istruzioni}}` are filled from `Astro.site`, which is the
staging host today, the branch's own URL in a Keystatic preview, and
`ventorelativo.it` after the cutover. A hardcoded address would send a volunteer
to the old Drupal site the day the domain moves.

## Why the prompt carries the instructions rather than a link

`robots.txt` returns `Disallow: /` for every host that is not the live domain,
and the assistant crawlers honour it, so until the cutover a model cannot read
`/redazione/istruzioni.txt` even when it is able to browse. Most free tiers
cannot browse at all. Pasting always works.

**After the cutover** a short link-only prompt becomes possible for the models
that can browse, which would fit in a `chatgpt.com/?q=…` deep link and turn the
flow into one click. It is worth revisiting then, not before: today it would
fail silently, which is the worst way for a tool aimed at volunteers to fail.

## Why today's date is added at copy time

The page is built once and read for months. A model that assumes the wrong date
decides next Saturday's event has already happened, and that is exactly the
mistake this is supposed to prevent. The copy button prepends the real date, so
it is the day the volunteer copied. The document tells the model to ask if it
does not know.

## Why there is a fourth list, and a gate for it

AGENTS.md rule 12: `src/content.config.ts`, `keystatic.config.ts` and
`src/components/mdx/components.ts` describe the same content and must agree.
`istruzioni.md` is a fourth description of the same thing, and the most
dangerous kind, because it is prose read by a machine that will not question a
field name that does not exist.

`npm run authoring:check` compares it with the Zod schemas:

- **field names, both ways.** In the schema and not in the document is a field
  the AI will never fill; in the document and not in the schema is an
  instruction to produce a value nobody can file.
- **news categories, both ways.** A closed `z.enum`, where `Hike & Fly` for
  `Hike&Fly` fails later with a Zod error a volunteer cannot read.
- **site tags, one way.** They are free strings by schema, so an editor may add
  one without touching the document; what must not happen is the document
  offering a vocabulary the club does not use.

Labels are not checked. They are what a volunteer matches to the form, but
Keystatic nests them past what a regex can follow honestly (`fields.ignored()`
has no label at all, and an array's label sits above its element's), and a wrong
label shows itself the first time somebody uses the page.

## Why the em dash gate exists now

Rule 11 has always said the character is not used here. It was kept by hand
because everything written in this repository was written by someone who knew
the rule. Inviting volunteers to draft posts with a language model changes that:
the em dash is the single house rule a model breaks by reflex, and the text
arrives through a Keystatic branch that no human reviews line by line.

`scripts/check-content.mjs` runs from `prebuild` as well as from `lint`, and
that placement is the point: Netlify builds a Keystatic branch with
`npm run build` and never runs `lint`. A check that lived only in `lint` would
miss every post an editor writes, which is the only text this was written for.

It does not run from `predev`: blocking a dev server over a punctuation mark
mid-draft helps nobody.

The trade is real and was taken deliberately: a volunteer can now fail their own
preview build over one character. The error names the file, the line and the
alternatives, and the alternative was catching it in review, which for a club
with four posts a year means catching it after publication.

## Changing the rules

Edit `src/authoring/istruzioni.md` and run `npm run verify`. Keep the
`blocco:` markers, keep the field tables agreeing with
`src/content.config.ts`, and remember that the audience is a machine that will
follow a vague instruction confidently rather than asking.
