# Assessment Engine (TypeScript / Vite / Dexie)

A local-first personal quiz and assessment platform for Snowflake, dbt, SQL,
and Data Engineering study. No backend, no accounts, no cloud database —
everything lives in your browser's IndexedDB.

This is the TypeScript project version of the app. A build-free single-HTML
version also exists if you just want to double-click and go; this version is
for further development, per the original spec's suggested stack (React,
TypeScript, Vite, Dexie.js, Tailwind CSS).

## Setup

```bash
npm install
npm run dev       # starts the dev server at http://localhost:5173
```

## Before you open the app: run the tests

I could not run `npm install` or a compiler in the sandbox this was built in
(no network access there), so **please run the test suite first** to confirm
everything actually compiles and behaves as intended on your machine:

```bash
npm install
npm run typecheck   # tsc -b --noEmit — strict-mode type check
npm test            # vitest — unit tests for scoring, spaced repetition,
                     # validation, analytics, and the daily quiz engine
```

If anything fails, it's safe to report back — nothing here has been verified
by an actual TypeScript compiler yet, only by careful manual review and by
running the equivalent plain-JS logic (extracted from an earlier prototype)
through Node directly.

## Build

```bash
npm run build      # tsc -b && vite build -> dist/
npm run preview    # preview the production build locally
```

## Project structure

```
src/
  types/            Question, Attempt, LearningState, Topic — the canonical
                     schema contract (matches the Question Generation Standard)
  services/         Pure domain logic + persistence orchestration
    validation.ts     Zod-based runtime schema validation for imports
    scoring.ts         Evaluates a response against a question (all 11 types)
    spacedRepetition.ts  SM-2 derived algorithm
    analytics.ts        Aggregation, weakness/strength detection
    dailyQuiz.ts         Pure, testable daily-quiz selection algorithm
    store.ts             Dexie persistence layer — the only place that touches db
  db/db.ts          Dexie schema definition
  data/             Small demo question set (clearly marked, removable)
  components/       Shared UI primitives (buttons, badges, code viewer, modal)
  features/         Feature-scoped pages/components (quiz, questions, topics,
                     analytics, import-export)
  pages/            Dashboard, Settings
  App.tsx           Routing shell
tests/              Vitest unit tests for the domain logic above
```

The architectural rule followed throughout: UI components never talk to
Dexie directly except through `services/store.ts`, and the algorithmically
interesting logic (scoring, spaced repetition, analytics, daily-quiz
selection) is written as pure functions so it's testable without a browser
or a real IndexedDB.

## What's tested

- **Scoring** — every question type, including multiple-choice partial
  credit, ordering, matching, numerical tolerance, and case-insensitive
  short answers.
- **Spaced repetition** — interval growth on success, reset on failure,
  and correct derivation of learning states (new/learning/review/due/
  mastered/difficult).
- **Validation** — accepts well-formed questions, rejects malformed ones
  with field-level reasons, detects duplicate IDs within a single import
  file, and never silently repairs invalid data.
- **Analytics** — never fabricates a score when there's no data (returns
  `null`, not `0%`), and the weak/strong-area engines respect a minimum
  sample threshold so a 2-question topic can't outrank an 80-question one.
- **Daily quiz** — never includes a topic marked "Not Started", never
  duplicates a question within a session, and prioritizes due questions.

## Known deviations from the original spec

- **Charts are simple horizontal bars**, not Recharts. `recharts` is listed
  as a dependency if you want to swap them in — the spec itself says "use
  charts only where they add value," and for this kind of information-dense
  study tool, bars were the better fit.
- **Ordering questions use up/down buttons**, not drag-and-drop.
- **No PWA/service worker** — the dev/build setup is standard Vite; offline
  support beyond normal browser caching isn't wired up.
- **Zod validation covers structural correctness**; a few cross-field rules
  (e.g., "single_choice needs exactly 1 correct option") are enforced as a
  second pass in `validateQuestion` rather than pure Zod refinements, for
  clearer per-field error messages in the import preview.

## Data safety

All data lives in this browser's IndexedDB under the origin you load the app
from. Clearing browser data will delete it. Use **Import / Export → Full
Backup** regularly.
