import { h } from "../dom.js";
import { state } from "../state.js";
import { freeTextSignals } from "../matching.js";
import { field, pills, importance, combobox, nextId } from "../ui.js";
import { loadZips, searchZips, findZip } from "../data/zipSearch.js";
import { STABILITY_NAVIGATOR_URL } from "../data/links.js";

const workTypes = [
  ["physical", "Physical", "Fixing and maintaining equipment"],
  ["build", "Mechanical", "Installing and building things"],
  ["technical", "Technical", "Working with data, computers, or control systems"],
  ["planning", "Planning", "Scheduling work and keeping projects on track"],
  ["teaching", "Teaching", "Training people and sharing know-how"],
  ["customer", "Customer-facing", "Helping clients solve problems"]
];
const pace = [
  ["routine", "Steady routine"], ["problems", "Solving problems as they come up"],
  ["pressure", "High-pressure fixes when something breaks"], ["project", "Project based"]
];
const where = [
  ["same", "Same site every day"], ["different", "Different sites (driving to jobs)"], ["indoors", "Indoors"],
  ["outdoors", "Outdoors"], ["office", "Office or remote"], ["none", "No preference"]
];
const people = [
  ["alone", "Mostly on my own"], ["crew", "With a small crew"], ["lead", "Leading a team"],
  ["customers", "Helping customers or the public"], ["mix", "A mix"]
];
const moments = [
  ["puzzle", "Solving the puzzle", "Figuring out what nobody else could"],
  ["pressure", "Fixing it under pressure", "When something broke and it mattered right now"],
  ["result", "Seeing the finished result", "Building something that works and lasts"],
  ["teaching", "Teaching someone new", "Watching them get it"],
  ["people", "Taking care of my people", "Knowing my team had what they needed"],
  ["operation", "Running a tight operation", "Everything planned, on time, accounted for"],
  ["trusted", "Being trusted with the mission", "Having responsibility on my shoulders"],
  ["learning", "Learning something new", "Getting certified, mastering a new system"],
  ["exact", "Getting it exactly right", "Precision, details, high standards"],
  ["bigger", "Being part of something bigger", "The purpose behind the work"],
  ["easier", "Making someone's day easier", "Directly helping the person in front of me"]
];
const hours = [
  ["days", "Daytime only"], ["evenings", "Evenings or nights are OK"], ["rotating", "Rotating shifts are OK"],
  ["weekends", "Weekends are OK"], ["parttime", "Part-time while I train"], ["contract", "Contract based"]
];

export function questionnaireView(ctx) {
  const a = state.answers;
  a.importance ||= {};
  loadZips(); // fetch the ZIP list now so the dropdown is instant
  let page = 0;
  const root = h("section", { class: "questions" });

  // One question: its title, the choices, and how much it matters.
  const question = (title, control, key, tip) => h("div", { class: "question" },
    field(title, control, tip),
    key ? importance(a.importance[key], (v) => (a.importance[key] = v)) : null);
  const num = (key, props = {}) => h("input", { type: "number", min: 0, inputmode: "decimal", value: a[key], ...props, oninput: (e) => (a[key] = e.target.value === "" ? "" : Number(e.target.value)) });
  const choose = (key, options, extra = {}) => pills({ options, selected: a[key], label: key, onchange: (v) => { a[key] = v; extra.after?.(v); }, ...extra });

  const pages = [
    { title: "The work", build: () => [
      question("What kind of work sounds good? (pick as many as apply)", choose("workTypes", workTypes), "work"),
      question("What pace suits you?", choose("pace", pace), "pace")] },

    { title: "Where and with whom", build: () => [
      question("Where do you want to work?", choose("where", where, { exclusive: ["none"] }), "where"),
      question("How do you like to work with people?", choose("people", people, { exclusive: ["mix"] }), "people")] },

    { title: "What mattered", build: () => [
      question("What were the moments in the service that felt most worth it? (pick up to 3)", choose("moments", moments, { max: 3 }), "moments",
        "These help us find work that feels the same way. Pick the three that sound most like you.")] },

    { title: "Hours, commute, and timing", build: () => {
      const helpNote = h("div", { class: "callout", role: "status" });
      const showHelp = () => {
        helpNote.hidden = a.needsHelp !== "yes";
        helpNote.replaceChildren(h("p", {}, h("strong", {}, "Thank you for telling us. "), "We'll put work you can start soonest first. If you have urgent needs like housing, food, or bills, we can connect you to services."),
          STABILITY_NAVIGATOR_URL
            ? h("p", {}, h("a", { class: "btn", href: STABILITY_NAVIGATOR_URL, target: "_blank", rel: "noopener" }, "Open Stability Navigator"))
            : h("p", {}, "We'll connect you to Stability Navigator here."),
          h("p", {}, h("small", {}, "If you're in crisis, call or text 988 and press 1 for the Veterans Crisis Line.")));
      };
      showHelp();
      const miles = num("commuteMiles");
      const flex = h("select", { id: nextId("flex"), onchange: (e) => (a.commuteFlex = Number(e.target.value)) },
        [[0, "Not willing to go farther"], [10, "10 more miles (+/- 10)"], [20, "20 more miles (+/- 20)"], [30, "30 more miles (+/- 30)"]]
          .map(([v, l]) => h("option", { value: v, selected: Number(a.commuteFlex) === v }, l)));
      const relocate = h("select", { id: nextId("reloc"), onchange: (e) => (a.relocate = e.target.value) },
        [["no", "No"], ["maybe", "Maybe"], ["yes", "Yes"]].map(([v, l]) => h("option", { value: v, selected: a.relocate === v }, l)));
      const zipInfo = h("p", { class: "found", role: "status" });
      const showZip = () => {
        zipInfo.textContent = a.zipPlace ? `✓ ${a.zip} · ${a.zipPlace}` : /^\d{5}$/.test(a.zip) ? `We don't have ZIP ${a.zip} in our list yet. We cover New Jersey for now.` : "";
      };
      const zipBox = combobox({ id: nextId("zip"), value: a.zip, label: "ZIP code", placeholder: "Type your ZIP code or town, then pick from the list",
        search: searchZips, onpick: (e) => { Object.assign(a, { zip: e.code, zipPlace: e.title, lat: e.lat, lng: e.lng }); showZip(); } });
      zipBox.input.addEventListener("input", () => {
        const v = zipBox.input.value.trim();
        const hit = /^\d{5}$/.test(v) ? findZip(v) : null;
        Object.assign(a, { zip: /^\d{5}$/.test(v) ? v : "", zipPlace: hit ? hit.title : "", lat: hit ? hit.lat : null, lng: hit ? hit.lng : null });
        showZip();
      });
      showZip();
      return [
        h("div", { class: "question" }, field("Where do you live?", h("div", {}, zipBox.el, zipInfo, h("p", { class: "hint" }, "We have New Jersey ZIP codes for now.")),
          "Type your ZIP code or your town, then pick from the list. We use it to find help near you.")),
        question("What hours can you work?", choose("hours", hours), "hours",
          "Pick everything that's OK. If you only pick Daytime only, we won't show jobs with nights or rotating shifts."),
        question("How far will you commute?", h("div", {}, miles,
          field("Would you go farther for a better job?", flex, "For a role with better pay or a clearer path, how much farther would you drive? A bigger number shows you more options."),
          field("Willing to relocate?", relocate)), "commute"),
        question("When do you need your first paycheck by?", h("input", { type: "date", value: a.incomeBy, onchange: (e) => (a.incomeBy = e.target.value) }), "timing"),
        h("div", { class: "question" }, field("Do you need help right now?",
          choose("needsHelp", [["yes", "Yes"], ["no", "No"]], { single: true, selected: a.needsHelp ? [a.needsHelp] : [],
            after: (v) => { a.needsHelp = v[0] || null; showHelp(); } }),
          "This sets your short-term goal. If you need help now, we'll focus on work you can start soonest and point you to services."), helpNote)];
    } },

    { title: "Money and training", build: () => {
      const err = h("p", { class: "error", role: "alert" });
      pages[4].validate = () => {
        const ok = Number(a.minHourly) > 0 && Number(a.minSalary) > 0;
        err.textContent = ok ? "" : "Please fill in both amounts. If you're not sure, give your best guess. You can change it later.";
        return ok;
      };
      // Typing one amount fills in the other (full-time is about 2,080 hours a year), so people can see both.
      // A value we filled in is replaced as they keep typing; one they typed themselves is left alone.
      const HOURS = 2080;
      const dollars = (n) => `$${Math.round(n).toLocaleString()}`;
      const hr = h("input", { id: nextId("hourly"), type: "number", min: 0, step: "0.5", inputmode: "decimal", value: a.minHourly, placeholder: "For example, 25" });
      const sal = h("input", { id: nextId("salary"), type: "number", min: 0, step: "1000", inputmode: "decimal", value: a.minSalary, placeholder: "For example, 52000" });
      const hrNote = h("p", { class: "convert", role: "status" });
      const salNote = h("p", { class: "convert", role: "status" });
      let autoHr = false;
      let autoSal = false;
      const notes = () => {
        hrNote.textContent = Number(a.minHourly) > 0 ? `That's about ${dollars(a.minHourly * HOURS)} a year, full-time.` : "";
        salNote.textContent = Number(a.minSalary) > 0 ? `That's about $${(a.minSalary / HOURS).toFixed(2)} an hour, full-time.` : "";
      };
      hr.addEventListener("input", () => {
        autoHr = false;
        a.minHourly = hr.value === "" ? "" : Number(hr.value);
        if (a.minHourly !== "" && (sal.value === "" || autoSal)) { a.minSalary = Math.round(a.minHourly * HOURS); sal.value = a.minSalary; autoSal = true; }
        else if (a.minHourly === "" && autoSal) { a.minSalary = ""; sal.value = ""; autoSal = false; }
        notes();
      });
      sal.addEventListener("input", () => {
        autoSal = false;
        a.minSalary = sal.value === "" ? "" : Number(sal.value);
        if (a.minSalary !== "" && (hr.value === "" || autoHr)) { a.minHourly = Math.round((a.minSalary / HOURS) * 100) / 100; hr.value = a.minHourly; autoHr = true; }
        else if (a.minSalary === "" && autoHr) { a.minHourly = ""; hr.value = ""; autoHr = false; }
        notes();
      });
      notes();
      return [
        question("What's the least you'd accept?", h("div", {},
          field("Hourly ($ per hour)", h("div", {}, hr, hrNote), null, { forId: hr.id }),
          field("Salary ($ per year)", h("div", {}, sal, salNote), null, { forId: sal.id }), err),
          "pay", "Some jobs pay by the hour and others pay a yearly salary. Type one and we fill in the other, based on a full-time year (2,080 hours). Change either one if your numbers differ. For example, $25 an hour or $52,000 a year."),
        question("Willing to take classes?", h("div", {}, choose("education", [["none", "No classes"], ["short", "Short courses (up to about 3 months)"], ["long", "Longer programs"], ["any", "No preference"]],
          { single: true, selected: [a.education], after: (v) => (a.education = v[0] || "short") }),
          field("Hours per week you could study", num("hoursPerWeek"))), "education")];
    } },

    { title: "Anything else?", build: () => {
      const signals = h("p", { class: "status" });
      const update = () => {
        const s = freeTextSignals(a.freeText);
        signals.textContent = s.notes.length ? `We picked up: ${s.notes.join(", ")}` : "";
      };
      update();
      return [question("What are you looking for, in your own words? (optional)",
        h("div", {}, h("textarea", { rows: 4, placeholder: "For example, a paid trade with daytime hours, close to home", oninput: (e) => { a.freeText = e.target.value; update(); } }, a.freeText), signals))];
    } }
  ];

  function show() {
    const p = pages[page];
    const last = page === pages.length - 1;
    root.replaceChildren(
      h("p", { class: "eyebrow" }, `Step ${page + 1} of ${pages.length}`),
      h("div", { class: "progress", role: "progressbar", "aria-valuemin": 1, "aria-valuemax": pages.length, "aria-valuenow": page + 1 },
        h("div", { style: `width:${((page + 1) / pages.length) * 100}%` })),
      h("h2", {}, p.title),
      ...p.build(),
      h("div", { class: "nav" },
        page ? h("button", { class: "secondary", onclick: () => { page -= 1; show(); window.scrollTo(0, 0); } }, "Back") : null,
        h("button", { onclick: () => {
          if (p.validate && !p.validate()) return;
          if (last) { state.answersDone = true; ctx.next(); } else { page += 1; show(); window.scrollTo(0, 0); }
        } }, last ? "See my skills" : "Next")));
  }
  show();
  return root;
}
