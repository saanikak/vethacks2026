import { h } from "./dom.js";
import { state, resetState, jordan, defaultAnswers } from "./state.js";
import { intakeView } from "./views/intake.js";
import { questionnaireView } from "./views/questionnaire.js";
import { skillsView } from "./views/skills.js";
import { targetView } from "./views/target.js";
import { gapsView } from "./views/gaps.js";
import { mapView } from "./views/map.js";

const steps = [
  { label: "Background", view: intakeView },
  { label: "Questions", view: questionnaireView, needs: () => state.jst },
  { label: "Skills", view: skillsView, needs: () => state.jst },
  { label: "Your target", view: targetView, needs: () => state.jst && state.answersDone },
  { label: "Gaps", view: gapsView, needs: () => state.jst && state.answersDone },
  { label: "Help nearby", view: mapView }
];
let current = 0;
const root = document.getElementById("app");

function go(i) {
  current = Math.max(0, Math.min(steps.length - 1, i));
  render();
  window.scrollTo(0, 0);
}

// Jordan Lee, the made-up demo veteran: every step starts filled in, beginning at Step 1.
function loadJordan() {
  resetState();
  state.demo = true;
  state.jst = structuredClone(jordan.jst);
  state.answers = { ...defaultAnswers(), ...structuredClone(jordan.answers) };
  state.answersDone = true;
  state.location = jordan.location;
  state.extraSkills = [...jordan.extraSkills];
  Object.assign(state, structuredClone(jordan.target)); // first job, grow step, dream job, note, comparison
  go(0);
}

// Back to a blank start, to show the generic workflow.
function startOver() {
  resetState();
  go(0);
}

// The brand mark: a white star inside a blue circle with a red ring.
const MARK = `<svg viewBox="0 0 64 64" width="44" height="44" focusable="false"><circle cx="32" cy="32" r="29" fill="#0A3161" stroke="#B31942" stroke-width="5"/><path fill="#fff" d="M32 13l5.6 12.2 13.3 1.5-9.9 9 2.8 13.1L32 42l-11.8 6.8 2.8-13.1-9.9-9 13.3-1.5z"/></svg>`;

function render() {
  const ctx = { next: () => go(current + 1), back: () => go(current - 1), refresh: render };
  const nav = h("nav", { class: "steps", "aria-label": "Progress" }, h("ol", {}, steps.map((s, i) => {
    const locked = s.needs && !s.needs();
    const cls = ["step", i === current ? "current" : "", i < current && !locked ? "done" : ""].filter(Boolean).join(" ");
    return h("li", {}, h("button", { class: cls, disabled: locked, "aria-current": i === current ? "step" : null, onclick: () => go(i) },
      h("span", { class: "step-num", "aria-hidden": "true" }, i < current && !locked ? "✓" : String(i + 1)), h("span", { class: "step-label" }, s.label)));
  })));
  const mark = h("span", { class: "brand-mark", "aria-hidden": "true" });
  mark.innerHTML = MARK; // static markup defined above, never user input
  root.replaceChildren(
    h("header", { class: "site-header" },
      h("div", { class: "brand" }, mark,
        h("div", {}, h("h1", {}, "Beyond the Uniform"), h("p", { class: "tagline" }, "Your service. Your skills. Your next chapter."))),
      state.demo ? h("p", { class: "demo-banner" }, "Demo: Jordan Lee, a made-up veteran. Every step is filled in.") : null,
      h("div", { class: "header-actions" },
        h("button", { class: "demo", onclick: loadJordan }, "Load demo: Jordan Lee"),
        h("button", { class: "demo", onclick: startOver }, "Start over"))),
    nav,
    h("main", {}, steps[current].view(ctx)),
    h("footer", { class: "site-footer" },
      h("p", { class: "footer-brand" }, "Beyond the Uniform"),
      h("p", {}, "Built for the Veteran's Day hackathon, 2026. Pay ranges, costs, and times are illustrative estimates."),
      h("p", { class: "footer-credits" }, "Code data: Defense Manpower Data Center military crosswalk via the O*NET Resource Center. ZIP data: GeoNames (geonames.org), CC BY 4.0. Maps © OpenStreetMap contributors.")));
}
render();
