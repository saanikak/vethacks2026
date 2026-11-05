# VetHacks 2026 – Veterans Build America (MVP)

Static web app for the Veteran's Day hackathon ("veteran's build"). Flow, built around the made-up demo veteran Jordan Lee (Army generator repairer, MOS 91D, single parent, made-up Riverbend County NJ, $25/hr minimum):

1. Share a background: resume, JST, and/or a code (MOS, AFSC, or Rate) on one page. Whatever is given is merged into one confirm form (job, pay grade, billets, tasks, courses, certifications)
2. Paged questionnaire (6 short pages). Each question has a Low/Medium/Strong "how much does this matter" control that weights the ranking
3. Skills translation: each card shows the military skill (what the person did), the corporate skill it shows, and how to say it (copy-ready; [X] placeholders are for the person's own numbers). Users can uncheck skills so they stop counting, and add skills from outside their record that count toward matches
4. Your target: "What sounds like you?" motivation cards (pre-selected from Questions answers), one target with three rings (Earn now 0–3 months, Grow 3–12 months, Dream 1–4 years), a role detail card, a Target/List view toggle, Compare, and a Your path strip (first step -> grow, optional -> dream)
5. Gaps for a role + one action this week (under 2 hours) with a deadline 7 days out and a backup plan
6. Map of in-person veteran employment help

No build step, no dependencies, no AI/API keys. Plain HTML + ES modules. Libraries load from CDNs at runtime: pdf.js, Tesseract.js, and Mammoth (file parsing, only when a file is uploaded) and Leaflet + OpenStreetMap tiles (map).

## Setup (new machine)

Requirements: `git` and `python3` (preinstalled on macOS). Node is not needed to run the app.

```sh
git clone git@github.com:saanikak/vethacks2026.git
cd vethacks2026
python3 serve.py
```

Open http://localhost:8000 and click **Load demo: Jordan Lee**. It starts at Step 1 with everything filled in for Jordan: the sample resume (`samples/jordan-lee-resume.txt`), JST (`samples/jordan-lee-jst.pdf`), and code 91D, the confirmed record, all the questions, the skills, and Jordan's target choices (first step, grow step, dream job, note, comparison), so every step can be shown without typing. **Start over** (next to it) returns to a blank slate to show the generic workflow. Jordan's data lives in `jordan` in `src/state.js`.

- Cloning over SSH needs an SSH key added to your GitHub account (https://github.com/settings/ssh/new). Otherwise clone with `https://github.com/saanikak/vethacks2026.git`.
- Serve over HTTP rather than opening `index.html` directly: ES modules are blocked on `file://` URLs.
- `serve.py` is `http.server` plus a no-cache header, so edits show up on a normal refresh. Plain `python3 -m http.server 8000` also works, but then hard-refresh (Cmd+Shift+R) after changes.
- If port 8000 is taken, pass another: `python3 serve.py 8001`.
- To try the JST flow, click "No JST handy? Try the sample" on step 1, or upload `samples/jordan-lee-jst.pdf` (made-up data).

## Layout

- `index.html` – page shell; `src/app.js` – step router and the Jordan demo loader
- `src/matching.js` – scoring, ring placement, and the dream-job path (**start here**; weights and ring rules are exported constants)
- `src/translate.js` – the translation rules: what someone did -> corporate skill -> how to say it (the 18-row table from the Skills spec, plus technical skills); typical tasks per code; tags for user-added skills. To add or change a skill, edit one entry in `rules`
- `src/jst.js` – JST and resume text parsers and redaction (SSN/DoD ID/email/phone removed before parsing). Dates and credit recommendations are deliberately not kept
- `src/ui.js` – shared form pieces: `help` (the "?" bubble), `field`, `pills` (tap choices), `importance`, `tagList`
- `src/data/zips.json` – ZIP codes with town and location (New Jersey only for now). **Generated** by `scripts/build-zips.py` from GeoNames (CC BY 4.0; attribution is shown in the app). Searched by `src/data/zipSearch.js`; the ZIP the person picks centers the help map
- `src/data/codes.json` – every MOS, AFSC, and rate (~12,000 codes, with the civilian jobs each lines up with). **Generated** by `scripts/build-codes.py`; don't hand-edit. Searched by `src/data/codeSearch.js`
- `src/data/military.js` – a small curated list of common codes with TYPICAL TASKS (used when a person gives no tasks), billets (with civilian equivalents), pay grades
- `src/data/links.js` – outside links (Stability Navigator URL goes here)
- `src/state.js` – shared state, default answers, Jordan's profile
- `src/data/dreams.js` – motivations (groups of role ids) for Your target, and how Questions answers pre-select them
- `src/data/careers.js` – ~25 curated roles; `src/data/pathways.js` – each role's Your target copy, work style, and time estimate; `src/data/credentials.js` – credential cost/time/funding/first step; `src/data/places.js` – map places
- `src/views/*.js` – one file per step; `src/dom.js` – tiny `h()` element helper

## Updating the ZIP list

`src/data/zips.json` comes from the GeoNames US postal code file (https://download.geonames.org/export/zip/US.zip, `US.txt` inside). It currently holds New Jersey only, matching the map's coverage. To rebuild or add states:

```sh
python3 scripts/build-zips.py path/to/US.txt            # New Jersey
python3 scripts/build-zips.py path/to/US.txt NJ NY PA   # chosen states
python3 scripts/build-zips.py path/to/US.txt all        # every state (about 2 MB)
```

## Updating the code list

`src/data/codes.json` comes from the DMDC military crosswalk published by the O*NET Resource Center (https://www.onetcenter.org/crosswalks.html, "Military Crosswalk" zip; the current build used the July 2024 edition). To refresh it, download and unzip that file, then:

```sh
python3 scripts/build-codes.py path/to/milx0724.csv
```

It keeps Army, Marine Corps, Air Force, Space Force, Navy, and Coast Guard codes; merges Air Force skill levels (3E032, 3E052 -> 3E0X2); marks retired codes; and drops qualifiers (ASI, SQI, SEI, NEC, billet codes). Check the data's license terms before redistributing it outside this project.

## Decisions (from the feature list)

- Job data: curated set of ~25 roles, not live data. Pay ranges and credential costs are illustrative estimates; verify before presenting as fact.
- No scores on screen: the hackathon ground rule is no aptitude scores, so never show `total` or a percentage. `total` (50% skills + 30% constraints + 20% interests) only orders roles internally. Show "You bring X of your N skills" instead. Nothing is hidden for low fit.
- Importance: each question's Low/Medium/Strong sets its weight (1/2/3) inside the constraints and interests parts. A "Strong" question the role fails demotes it a ring (hours and pay start at Strong). "Need help now = yes" makes income timing Strong.
- Pay: users give both an hourly minimum and a yearly salary minimum. Typing one fills in the other (2,080 hours = a full-time year) and shows the conversion; each can still be changed. Each role is compared on one of them (`SALARIED` in `matching.js`).
- Apprenticeships are not a question. They are a layer on Your target ("Show everything / Only apprenticeships / Skip apprenticeships", saved as `state.apprenticeship`). A role counts as an apprenticeship role if one of its required credentials ends in `_apprenticeship` (`requiresApprenticeship` in `matching.js`), and its cards get a "Requires apprenticeship" tag.
- Commute: "go farther for a better job" adds 0/10/20/30 miles of flexibility.
- Answers shape: see `defaultAnswers` in `state.js`. Questionnaire choices map to interest tags in `WORK_TAGS` / `MOMENT_TAGS` in `matching.js`.
- Your target rings are based on time, not score: with nothing missing, time = the role's `baseWeeks`; with a credential missing, time = its `months` in `pathways.js`. Up to 3 months = Earn now, up to 12 = Grow, longer = Dream.
- Target layout: `SLOTS`, `CHIP_AT`, and `RADIUS` in `src/views/target.js` hold max 3 pills per ring, chosen first, then the selected role, then ones that fit a motivation, with one slot kept for a non-matching role when matches would fill the ring; the rest collapse into a "+N more" chip that opens List view. Re-check that pills stay inside their bands if these change.
- Choosing: one tap on a pill chooses it for its ring and opens its details; tapping again removes it. List view has a choose button on every role. A sticky bar shows the three picks.
- Choices: `state.firstJob` must be in the inner ring, `state.growJob` the middle, `state.dream` the outer; `targetView` clears any that no longer match. Gaps uses `state.selected`, then dream, then first step, then grow.
- Pay limit: a role only fails on pay if the top of its range is under the minimum. A role that starts under it gets a note in Compare (`note` on the pay check) but no warning.
- The internal strong/stretch/reach `ring` value is still computed in `scoreRole`. It sets the default role on the Gaps step when nothing is chosen.
- Choices on Your target come from the person, with one exception: in the demo, Jordan's first step, grow step, dream job, and note are preset (`jordan.target` in `src/state.js`) so every step is populated. Confirming Step 1 again keeps them in the demo, and outside the demo it keeps them unless the record changed.
- Map coverage: New Jersey only. Riverbend County isn't a real place, so the demo map labels it as made up and keeps its sample pins at real NJ coordinates.

## Known gaps / TODO

- `src/data/places.js` holds SAMPLE placeholder entries (no real addresses or phone numbers). Replace with records from the official VA facility locator (VA Lighthouse Facilities API, needs a key) and the DOL American Job Center directory (CareerOneStop).
- JST and resume parsing are heuristic. They were only tested on made-up documents (including `samples/jordan-lee-jst.pdf`), not a real JST, whose layout may differ. If a real JST parses badly, adjust the patterns in `src/jst.js`. The confirm step exists because parsing will make mistakes.
- Typical tasks exist only for the ~100 codes in `src/data/military.js`. Every other code falls back to its title plus the civilian jobs O*NET links to it (labelled "typical"), which gives weaker skills. Add entries to `military.js` for codes you expect in the demo.
- Codes are not unique across services (EM is both Navy and Coast Guard; 91D has a current and a retired meaning), so search shows the branch and flags retired codes and lets the person pick.
- `STABILITY_NAVIGATOR_URL` in `src/data/links.js` is empty. Until it's filled in, the "need help now" note shows without a link.
- Questionnaire: "contract based" and "part-time while I train" hours are collected but not scored yet, and role data has no pace or site info, so pace and "same site vs different sites" are inferred in `matching.js`.
- Privacy: files are read in the browser and discarded; nothing is uploaded or stored. Keep it that way.

## Workflow

- Branch: `main`, remote `origin` (github.com/saanikak/vethacks2026).
- Pull before you start (`git pull`) and push small commits often to avoid conflicts, especially in the `src/data/` files.
- No test suite yet. Quick logic check with Node: import `src/state.js`, `src/translate.js`, `src/matching.js` and call `rankRoles(...)` for Jordan's profile.
