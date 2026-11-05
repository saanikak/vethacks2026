import { h } from "../dom.js";
import { state, profile } from "../state.js";
import { rolesByHorizon, scoreRole, fitSummary, limitProblems, daytimeOnly, requiresApprenticeship, HORIZONS, HORIZON_ORDER } from "../matching.js";
import { careers } from "../data/careers.js";
import { pathways } from "../data/pathways.js";
import { dreamThemes, motivationsFromAnswers } from "../data/dreams.js";
import { skillLabels } from "../translate.js";
import { pills } from "../ui.js";

const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
};
const usd = (n) => `$${Math.round(n / 1000)}k`;
const payRange = (role) => `${usd(role.pay.lo)}–${usd(role.pay.hi)}/yr`;
const SCHEDULE = { days: ["Often daytime", "sched-days"], mixed: ["Shifts vary", "sched-vary"], shifts: ["Nights or rotating", "sched-vary"] };
const MODE_CLASS = { "Hands-on": "mode-hands", Mix: "mode-mix", "Desk + floor": "mode-floor", Desk: "mode-floor" };
const skillNames = (tags) => tags.map((t) => skillLabels[t]).join(", ");
const bullets = (items, cls, empty) => (items.length ? h("ul", { class: cls }, items.map((t) => h("li", {}, t))) : empty);

function timeLabel(s) {
  if (!s.missing.length) return `About ${s.weeks} weeks`;
  const m = Math.round(s.months);
  if (m >= 24) return `About ${Math.round(m / 12)} years`;
  return `About ${m} month${m === 1 ? "" : "s"}`;
}

// "by January" from the date the user needs income, or a neutral phrase without one.
function earnBy(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d) ? "soon" : `by ${d.toLocaleString("en-US", { month: "long", timeZone: "UTC" })}`;
}

// Which choice each ring feeds. A role can only be chosen for the ring it sits in.
const CHOICE = {
  earn: { key: "firstJob", make: "Make this my first step", on: "✓ Your first step (tap to remove)", badge: "First step", cls: "first", status: "Your first step" },
  train: { key: "growJob", make: "Make this my grow step", on: "✓ Your grow step (tap to remove)", badge: "Grow", cls: "grow", status: "Your grow step" },
  big: { key: "dream", make: "★ Make this my dream", on: "★ Your dream (tap to remove)", badge: "★ Dream", cls: "dream", status: "★ Your dream" }
};

// Target layout, in units on an 880 x 880 stage centered on 0,0. Every slot is checked to stay inside
// its ring band, including the corners of the pill. Change these together with the ring radii.
const SIZE = 880;
const RADIUS = { you: 46, earn: 205, train: 325, big: 438 };
const PILL = { w: 136, h: 60 };
const CHIP = { w: 78, h: 54 };
const SLOTS = { earn: [[0, -112], [-112, 58], [112, 58]], train: [[0, -254], [-105, 236], [105, 236]], big: [[0, -374], [-105, 360], [105, 360]] };
const CHIP_AT = { earn: [0, 138], train: [265, 0], big: [382, 0] };
const LABEL_Y = { earn: -180, train: -309, big: -422 };
const box = ([x, y], { w, hh }) => `left:${((x - w / 2 + SIZE / 2) / SIZE) * 100}%;top:${((y - hh / 2 + SIZE / 2) / SIZE) * 100}%;width:${(w / SIZE) * 100}%;height:${(hh / SIZE) * 100}%`;

export function targetView(ctx) {
  const prof = profile();
  const scored = new Map(careers.map((c) => [c.id, scoreRole(c, prof)]));
  const score = (id) => scored.get(id);

  // A choice can go stale if skills changed and the role moved to another ring.
  for (const [ring, c] of Object.entries(CHOICE)) if (state[c.key] && score(state[c.key])?.horizon !== ring) state[c.key] = null;
  const suggested = motivationsFromAnswers(state.answers);
  if (!state.motivationsEdited) state.motivations = suggested;

  const chosenIds = () => HORIZON_ORDER.map((k) => state[CHOICE[k].key]).filter(Boolean);
  const themesFor = (id) => dreamThemes.filter((t) => state.motivations.includes(t.id) && t.roles.includes(id));
  const fits = (id) => themesFor(id).length > 0;
  const choiceFor = (id) => HORIZON_ORDER.map((k) => CHOICE[k]).find((c) => state[c.key] === id);

  const by = earnBy(state.answers.incomeBy);
  const leads = {
    earn: `${daytimeOnly(state.answers) ? "Day-shift work" : "Work"} that can get you paid ${by} and build civilian experience.`,
    train: "A few months of training can open these doors.",
    big: "Apprenticeships and advancement paths that take longer and can pay more."
  };

  const targetBox = h("div", { class: "tgt-area" });
  const detailBox = h("div", { class: "tgt-detail", "aria-live": "polite" });
  const listBox = h("div", { class: "tgt-list" });
  const pathBox = h("div", { class: "path-box" });
  const lastShown = {}; // keeps a role in the same spot when it's chosen, so pills don't jump under the finger
  const compareBox = h("div", { class: "compare", "aria-live": "polite" });
  const viewButtons = {};

  // Repaint everything except the form controls, and put keyboard focus back where it was.
  function paint() {
    const focus = document.activeElement?.dataset?.focus;
    const groups = rolesByHorizon(prof, undefined, { apprenticeship: state.apprenticeship, keep: chosenIds() });
    paintTarget(groups);
    paintList(groups);
    paintDetail();
    paintPath();
    paintCompare();
    for (const [k, b] of Object.entries(viewButtons)) b.setAttribute("aria-pressed", String(state.targetView === k));
    targetBox.hidden = state.targetView !== "target";
    detailBox.hidden = state.targetView !== "target";
    listBox.hidden = state.targetView !== "list";
    if (focus) document.querySelector(`[data-focus="${focus}"]`)?.focus();
  }

  // One tap chooses a role for its ring and opens its details. Tapping it again removes it.
  function tapRole(id) {
    state.targetRole = id;
    toggleChoice(id);
  }
  function toggleChoice(id) {
    const c = CHOICE[score(id).horizon];
    state[c.key] = state[c.key] === id ? null : id;
    state.selected = null; // Gaps follows the new choices unless they pick a role there on purpose
    paint();
  }
  function goToGaps(id) {
    state.selected = id;
    ctx.next();
  }

  // ---- The target ----
  // Share slots across the picked motivations, newest pick first, so each pick shows up on the target.
  function fitsInTurn(list) {
    const queues = [...state.motivations].reverse().map((id) => {
      const roles = dreamThemes.find((t) => t.id === id)?.roles || [];
      return list.filter((s) => roles.includes(s.role.id));
    });
    const out = new Set();
    for (let round = 0; queues.some((q) => q[round]); round++) queues.forEach((q) => q[round] && out.add(q[round]));
    return [...out];
  }

  function visibleRoles(ring, list) {
    const room = SLOTS[ring].length;
    const pinned = list.filter((s) => chosenIds().includes(s.role.id));
    const open = state.targetRole && !pinned.some((s) => s.role.id === state.targetRole) ? list.filter((s) => s.role.id === state.targetRole) : [];
    const first = [...pinned, ...open];
    const matches = fitsInTurn(list).filter((s) => !first.includes(s));
    const others = list.filter((s) => !first.includes(s) && !matches.includes(s)); // already in order, from rolesByHorizon
    // Keep one faded role in view when matches would fill the ring, so it's clear nothing is ruled out.
    const left = room - first.length;
    const fitRoom = others.length && !first.some((s) => !fits(s.role.id)) ? Math.max(0, left - 1) : left;
    const picked = [...first, ...matches.slice(0, fitRoom)];
    const shown = [...picked, ...others, ...matches.slice(fitRoom)].slice(0, room);
    const slots = Array(room).fill(null);
    (lastShown[ring] || []).forEach((id, i) => { const s = shown.find((x) => x.role.id === id); if (s) slots[i] = s; });
    for (const s of shown) if (!slots.includes(s)) slots[slots.indexOf(null)] = s;
    lastShown[ring] = slots.map((s) => s?.role.id);
    return slots;
  }

  function nextStepText() {
    if (state.firstJob && !state.dream) return "Great first step. Now pick a dream in the outer ring.";
    if (state.dream && !state.firstJob) return "Great dream. Now pick a first step in the inner ring.";
    if (state.firstJob && state.dream) return state.growJob ? "Your path is set. You chose these. Change them any time." : "Add a grow step in the middle ring if you want one, or see your gaps below.";
    return "Start with a first step in the inner ring.";
  }

  function picksBar() {
    return h("div", { class: "tgt-bar", "aria-live": "polite" },
      h("div", { class: "tgt-bar-slots" }, HORIZON_ORDER.map((ring) => {
        const c = CHOICE[ring];
        const id = state[c.key];
        return h("div", { class: id ? `tgt-bar-slot chosen-${c.cls}` : "tgt-bar-slot" },
          h("span", { class: "tgt-bar-label" }, `${c.badge}${ring === "train" ? " (optional)" : ""}`),
          h("strong", {}, id ? score(id).role.title : "Not chosen yet"));
      })),
      h("p", { class: "tgt-bar-next" }, nextStepText()));
  }

  function paintTarget(groups) {
    const placed = new Map();
    const stage = h("div", { class: "tgt-stage" });
    const art = svg("svg", { viewBox: `${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`, class: "tgt-art", "aria-hidden": "true" });
    for (const k of ["big", "train", "earn"]) art.append(svg("circle", { r: RADIUS[k], class: `tgt-ring tgt-ring-${k}` }));
    art.append(svg("circle", { r: RADIUS.you, class: "tgt-ring tgt-ring-you" }),
      svg("text", { y: -3, class: "tgt-you-title", "text-anchor": "middle" }, "YOU"),
      svg("text", { y: 18, class: "tgt-you-sub", "text-anchor": "middle" }, `${prof.skills.length} skill${prof.skills.length === 1 ? "" : "s"}`));

    const pillsOut = [];
    for (const ring of HORIZON_ORDER) {
      const list = groups[ring];
      const shown = visibleRoles(ring, list);
      shown.forEach((s, i) => {
        if (!s) return;
        const id = s.role.id;
        const at = SLOTS[ring][i];
        placed.set(id, at);
        const choice = choiceFor(id);
        const look = state.motivations.length ? (fits(id) ? "fit" : "faded") : "plain";
        const selected = state.targetRole === id;
        pillsOut.push(h("button", { type: "button", class: `tgt-role ${look}${choice ? ` chosen-${choice.cls}` : ""}${selected ? " selected" : ""}`,
          style: box(at, { w: PILL.w, hh: PILL.h }), "data-focus": `pill-${id}`, "data-ring": ring, "aria-pressed": String(!!choice),
          "aria-label": `${s.role.title}, ${HORIZONS[ring].label}${choice ? `, ${choice.status}` : ""}${look === "fit" ? ", fits what you picked" : ""}`,
          onclick: () => tapRole(id) },
          choice ? h("span", { class: `tgt-badge badge-${choice.cls}` }, choice.badge) : null,
          h("span", { class: "tgt-role-name" }, s.role.title)));
      });
      const extra = list.length - shown.filter(Boolean).length;
      if (extra > 0) pillsOut.push(h("button", { type: "button", class: "tgt-more", style: box(CHIP_AT[ring], { w: CHIP.w, hh: CHIP.h }), "data-ring": ring, "data-focus": `more-${ring}`,
        "aria-label": `${extra} more ${HORIZONS[ring].label} roles. Opens the list.`, onclick: () => showList(ring) }, `+${extra} more`));
    }

    // Dashed line: first step -> grow (optional) -> dream, behind the pills.
    const stops = chosenIds().map((id) => placed.get(id)).filter(Boolean);
    if (stops.length > 1) art.append(svg("polyline", { points: stops.map((p) => p.join(",")).join(" "), class: "tgt-path" }));
    for (const k of HORIZON_ORDER) art.append(svg("text", { y: LABEL_Y[k], class: `tgt-label tgt-label-${k}`, "text-anchor": "middle" }, `${HORIZONS[k].label} · ${HORIZONS[k].span}`));

    stage.append(art, ...pillsOut);
    targetBox.replaceChildren(picksBar(),
      h("p", { class: "tgt-how" }, "Choose your short-term, growth, and long-term goals: tap one role in each ring. Tap it again to remove it. See more roles with the \u201c+ more\u201d buttons."),
      h("div", { class: "tgt-scroll" }, stage),
      h("p", { class: "legend tgt-scroll-hint" }, "Swipe sideways to see the whole target, or use List view."),
      h("p", { class: "legend" }, state.motivations.length
        ? "Solid roles fit what you picked. Faded roles are still open to you. Nothing is ruled out."
        : "Pick what sounds like you to highlight roles. Nothing is ruled out."));
  }

  // ---- Detail card ----
  function paintDetail() {
    const id = state.targetRole;
    if (!id) return detailBox.replaceChildren(h("p", { class: "tgt-hint" }, "Tap a role on the target to choose it and see what it takes."));

    const s = score(id);
    const ring = s.horizon;
    const path = pathways[id];
    const [schedule, schedClass] = SCHEDULE[s.role.hours];
    const c = CHOICE[ring];
    const isOn = state[c.key] === id;
    const picked = themesFor(id).map((t) => t.label);
    const problems = limitProblems(s);
    detailBox.replaceChildren(h("article", { class: "opp-card" },
      h("p", { class: "eyebrow" }, `${HORIZONS[ring].label} · ${HORIZONS[ring].span}`),
      h("div", { class: "opp-card-head" }, h("h3", {}, s.role.title),
        h("div", { class: "opp-tags" }, h("span", { class: `tag ${MODE_CLASS[path.mode]}` }, path.mode), h("span", { class: `tag ${schedClass}` }, schedule),
          requiresApprenticeship(s.role) ? h("span", { class: "tag tag-appr" }, "Requires apprenticeship") : null)),
      h("p", { class: "opp-meta" }, `${payRange(s.role)} (estimate) · ${timeLabel(s)}`),
      h("p", {}, path.blurb),
      picked.length ? h("p", { class: "opp-bring" }, h("strong", {}, "Fits what you picked: "), picked.join(", ")) : null,
      h("p", { class: "opp-bring" }, h("strong", {}, `You bring ${s.matchedSkills.length} of your ${prof.skills.length} skills`), s.matchedSkills.length ? `: ${skillNames(s.matchedSkills)}` : ". This one would be new ground."),
      h("p", { class: "opp-how" }, h("strong", {}, "How to get there: "), path.how),
      problems.length ? h("ul", { class: "opp-warn" }, problems.map((p) => h("li", {}, `Doesn't fit your limit on ${p}`))) : null,
      h("div", { class: "opp-actions" },
        h("button", { class: isOn ? "choose on" : "choose", "data-focus": "choose", "aria-pressed": String(isOn), onclick: () => toggleChoice(id) }, isOn ? c.on : c.make),
        h("button", { class: "secondary strong", "data-focus": "compare", "aria-pressed": String(state.compare.includes(id)), onclick: () => toggleCompare(id) }, state.compare.includes(id) ? "✓ Comparing" : "Compare this path"),
        h("button", { class: "secondary", onclick: () => goToGaps(id) }, "See gaps"))));
  }

  // ---- List view ----
  function showList(ring) {
    state.targetView = "list";
    paint();
    const el = document.getElementById(`list-${ring}`);
    el?.scrollIntoView({ block: "start" });
    el?.querySelector("button")?.focus();
  }
  function openInTarget(id) {
    state.targetRole = id;
    state.targetView = "target";
    paint();
    document.querySelector(`[data-focus="pill-${id}"]`)?.focus();
    targetBox.scrollIntoView({ block: "start" });
  }
  function paintList(groups) {
    listBox.replaceChildren(...HORIZON_ORDER.map((ring) => h("div", { id: `list-${ring}`, class: "tgt-list-ring" },
      h("p", { class: "eyebrow" }, `${HORIZONS[ring].label} · ${HORIZONS[ring].span}`),
      h("h3", {}, HORIZONS[ring].heading),
      h("p", { class: "opp-lead" }, leads[ring]),
      groups[ring].length ? h("ul", { class: "tgt-list-roles" }, groups[ring].map((s) => {
        const id = s.role.id;
        const choice = choiceFor(id);
        const status = choice ? choice.status : fits(id) ? "Fits what you picked" : "Other option";
        const c = CHOICE[ring];
        return h("li", { class: "tgt-list-row" }, h("button", { type: "button", class: `tgt-list-role${choice ? ` chosen-${choice.cls}` : fits(id) ? " fit" : ""}`, onclick: () => openInTarget(id) },
          h("span", {}, h("strong", {}, s.role.title), h("small", {}, `${payRange(s.role)} (estimate) · ${timeLabel(s)}`)),
          h("span", { class: `tgt-status${choice ? ` badge-${choice.cls}` : fits(id) ? " status-fit" : ""}` }, status)),
          h("button", { type: "button", class: choice ? "secondary tgt-list-choose on" : "secondary tgt-list-choose", "data-focus": `list-choose-${id}`, "aria-pressed": String(!!choice), "aria-label": `${choice ? "Remove" : c.make}: ${s.role.title}`, onclick: () => toggleChoice(id) }, choice ? "Remove" : c.make));
      })) : h("p", {}, "No roles here with your apprenticeship setting."))));
  }

  // ---- Your path ----
  function paintPath() {
    const slot = (ring, title) => {
      const id = state[CHOICE[ring].key];
      return h("li", { class: id ? "path-step" : "path-step empty" },
        h("p", { class: "eyebrow" }, title),
        id ? [h("h4", {}, score(id).role.title), h("p", {}, h("strong", {}, "How to get there: "), pathways[id].how)]
          : h("p", {}, ring === "train" ? "Optional. Choose a role in the middle ring if you want a step in between." : `Choose a role in the ${ring === "earn" ? "inner" : "outer"} ring.`));
    };
    const canCompare = state.firstJob && state.dream;
    pathBox.replaceChildren(
      h("h3", {}, "Your path"),
      h("p", { class: "opp-lead" }, "You chose these. Change them any time."),
      h("ol", { class: "path" }, slot("earn", "First step"), slot("train", "Grow (optional)"), slot("big", "★ Dream")),
      h("div", { class: "opp-actions tgt-path-actions" },
        h("button", { class: "secondary strong", disabled: !canCompare, onclick: () => {
          state.compare = [state.firstJob, state.dream];
          paint();
          compareBox.scrollIntoView({ block: "nearest" });
        } }, "Compare first step vs. dream"),
        h("button", { onclick: () => goToGaps(state.dream || state.firstJob || state.growJob) }, "See my gaps →")),
      h("p", { class: "hint", hidden: canCompare ? true : null }, "Choose a first step and a dream to compare them."));
  }

  // ---- Compare ----
  function toggleCompare(id) {
    const had = state.compare.includes(id);
    state.compare = had ? state.compare.filter((x) => x !== id) : [...state.compare, id].slice(-2);
    paint();
    if (!had && state.compare.length === 2) compareBox.scrollIntoView({ block: "nearest" });
  }
  function paintCompare() {
    const ss = state.compare.map(score);
    if (!ss.length) return compareBox.replaceChildren();
    const clear = () => { state.compare = []; paint(); };
    if (ss.length === 1) {
      return compareBox.replaceChildren(h("p", { class: "compare-hint" }, `Comparing ${ss[0].role.title}. Choose one more role, from any ring.`,
        h("button", { class: "linklike", onclick: clear }, "Clear")));
    }
    const row = (label, fn) => h("tr", {}, h("th", { scope: "row" }, label), ss.map((s) => h("td", {}, fn(s))));
    compareBox.replaceChildren(
      h("div", { class: "compare-head" }, h("h3", {}, "Compare two paths"), h("button", { class: "linklike", onclick: clear }, "Clear")),
      h("div", { class: "table-scroll" }, h("table", { class: "compare-table" },
        h("thead", {}, h("tr", {}, h("td", {}), ss.map((s) => h("th", { scope: "col" }, s.role.title)))),
        h("tbody", {},
          row("Ring", (s) => `${HORIZONS[s.horizon].label} (${HORIZONS[s.horizon].span})`),
          row("Time to reach this role", timeLabel),
          row("Estimated pay", (s) => payRange(s.role)),
          row("Schedule", (s) => SCHEDULE[s.role.hours][0]),
          row("Work style", (s) => pathways[s.role.id].mode),
          row("What fits", (s) => bullets(fitSummary(s).fits, "fit-list ok", "Nothing yet")),
          row("What's missing or risky", (s) => bullets(fitSummary(s).risks, "fit-list no", "Nothing flagged"))))));
  }

  // ---- Controls that stay in place across repaints ----
  const viewToggle = h("div", { class: "tgt-toggle", role: "group", "aria-label": "How to view your roles" },
    ["target", "list"].map((k) => {
      viewButtons[k] = h("button", { type: "button", "data-focus": `view-${k}`, onclick: () => { state.targetView = k; paint(); } }, k === "target" ? "Target view" : "List view");
      return viewButtons[k];
    }));
  const motivations = pills({
    options: dreamThemes.map((t) => [t.id, t.label, t.blurb, suggested.includes(t.id) ? "From your answers" : null]),
    selected: state.motivations, label: "What sounds like you",
    onchange: (sel) => { state.motivations = sel; state.motivationsEdited = true; paint(); } });
  const note = h("textarea", { id: "target-note", rows: 2, placeholder: "For example, being home by 5", oninput: (e) => (state.dreamNote = e.target.value) }, state.dreamNote);

  // The encouragement people see first: they already have a lot to build on.
  const heroSkills = prof.skillItems.filter((s) => s.confirmed).map((s) => s.corporate).slice(0, 4);
  const hero = h("div", { class: "hero" },
    h("p", { class: "eyebrow" }, "Your potential"),
    h("h3", {}, "You have plenty of skills, and they can take you far."),
    h("p", {}, "We want to help you see and actualize that potential, today and beyond. Start close to the center, then aim as far out as you dare."),
    heroSkills.length ? h("p", { class: "hero-skills" }, `You already bring ${prof.skills.length} skills employers hire for, like ${heroSkills.join(", ")}.`) : null);

  paint();
  return h("section", { class: "opp target-screen" },
    h("div", { class: "tgt-head" }, h("h2", {}, "Your target"), viewToggle),
    hero,
    h("p", { class: "opp-intro" }, `The inner ring is work that can get you earning ${by}. Each ring out takes more training and can pay off further down the road.`),
    h("div", { class: "motivations" }, h("h3", {}, "What sounds like you?"), h("p", { class: "hint" }, "Pick as many as you like."), motivations),
    targetBox, listBox, detailBox, pathBox, compareBox,
    h("label", { for: "target-note" }, "Anything else you want from your career? (optional)"), note,
    h("details", { class: "tgt-more-options" }, h("summary", {}, "Apprenticeship options"),
      h("p", { class: "hint" }, "Some roles require an apprenticeship: paid, structured training that can take a few years. Do you want to see them?"),
      pills({ options: [["all", "Show everything"], ["only", "Only apprenticeships"], ["none", "Skip apprenticeships"]], selected: [state.apprenticeship], single: true, label: "Apprenticeships",
        onchange: (v) => { state.apprenticeship = v[0] || "all"; paint(); } })),
    h("p", { class: "rule" }, "Pay and time ranges are illustrative estimates. You decide what to pursue."));
}
