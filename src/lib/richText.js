// Shared helpers for rich-text entry content.
//
// Entry `content` is stored as lightweight HTML produced by the WYSIWYG editor
// (bold/italic/underline plus highlight markers applied to the current
// selection). These helpers keep the HTML safe to render and provide a single
// source of truth for parsing the `/todo@Name task` markers that the editor
// inserts as plain text inside the HTML. The todo patterns also still match
// legacy plain-text content.

// Inline formatting tags the editor is allowed to emit. Everything else (and all
// attributes) is stripped, so stored/rendered content can't carry scripts or
// event handlers — even when pasted in from another app. `span` is deliberately
// excluded: the only spans in play are the throwaway todo-line wrappers added by
// decorateTodos(), which must NOT persist — sanitize unwraps them so stored
// content stays clean text and never accumulates nested wrappers.
const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "br", "div", "p", "mark"];

// The only attribute value kept on any tag: the highlight colour class set by
// the editor. Matched as a single, exact class so no arbitrary classes/styles
// can ride along.
const ALLOWED_CLASS = /^marker-(yellow|green|blue|pink)$/;

export function sanitizeHtml(html) {
  if (!html) return "";
  let out = String(html);
  // Drop script/style blocks together with their contents.
  out = out.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  // Rebuild every remaining tag, dropping all attributes except a whitelisted
  // marker class; remove non-whitelisted tags while keeping their inner text.
  out = out.replace(
    /<(\/?)([a-zA-Z0-9]+)([^>]*?)\/?>/g,
    (match, slash, tag, attrs) => {
      const name = tag.toLowerCase();
      if (!ALLOWED_TAGS.includes(name)) return "";
      if (slash) return `</${name}>`;
      const classMatch = attrs.match(/class\s*=\s*["']([^"']*)["']/i);
      if (classMatch && ALLOWED_CLASS.test(classMatch[1].trim())) {
        return `<${name} class="${classMatch[1].trim()}">`;
      }
      return `<${name}>`;
    },
  );
  return out;
}

// Matches both legacy plain-text content and the HTML produced by the editor:
// the assignee tag stops at whitespace or the next tag, the title stops at a
// line break or the next tag boundary. The tag may carry several members and an
// optional date (`/todo@Anna+Ben@01.10.2026 Aufgabe`); parseAssigneeTag splits
// those out of the matched group.
export function createTodoRegex() {
  return /\/(todo|done)@([^\s<]+)[ \t]+([^<\n]+)/g;
}

// Accepted date tokens inside a marker tag: German (01.10.2026) and ISO
// (2026-10-01). Anything else is treated as part of a member name.
const TAG_DATE_GERMAN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const TAG_DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

// True only for a real calendar date (rejects e.g. 31.02.2026).
const isRealDate = (year, month, day) => {
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
};

const pad2 = (n) => String(n).padStart(2, "0");

// Whether a token looks like a date at all (even an impossible one).
const isDateShaped = (token) =>
  TAG_DATE_GERMAN.test(token) || TAG_DATE_ISO.test(token);

// Date token → ISO date string, or null when it isn't a real calendar date.
const dateTokenToIso = (token) => {
  let match = token.match(TAG_DATE_GERMAN);
  if (match) {
    const [, d, m, y] = match.map(Number);
    return isRealDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : null;
  }
  match = token.match(TAG_DATE_ISO);
  if (match) {
    const [, y, m, d] = match.map(Number);
    return isRealDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : null;
  }
  return null;
};

// Split a marker's assignee tag (`Anna_Muster+Ben_Meier@01.10.2026`) into
// member names and an ISO scheduled date. Underscores map back to spaces, `+`
// separates members. A date-looking suffix that isn't a real calendar date is
// stripped but yields no schedule (better than treating it as a member name).
export function parseAssigneeTag(tag) {
  let memberPart = tag;
  let scheduled = null;
  const at = tag.lastIndexOf("@");
  if (at !== -1) {
    const suffix = tag.slice(at + 1);
    if (isDateShaped(suffix)) {
      memberPart = tag.slice(0, at);
      scheduled = dateTokenToIso(suffix);
    }
  }
  const assignees = memberPart
    .split("+")
    .map((name) => name.replace(/_/g, " ").trim())
    .filter(Boolean);
  return { assignees, scheduled };
}

// Parse every `/todo@...` / `/done@...` marker out of entry content — one
// result per member, so a multi-member marker fans out into one todo each.
// `done` reflects the marker only at first sight (used when inserting a
// brand-new row); the todos table owns it afterwards.
export function parseTodoMarkers(content) {
  const out = [];
  if (!content) return out;
  const regex = createTodoRegex();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const { assignees, scheduled } = parseAssigneeTag(match[2]);
    const title = match[3].trim();
    for (const assignee of assignees) {
      out.push({ assignee, title, done: match[1] === "done", scheduled });
    }
  }
  return out;
}

// Build the marker tag the editor inserts: member names joined with `+`
// (spaces become underscores), plus the German-format date when scheduled.
export function buildTodoTag(names, scheduledIso) {
  const memberPart = names.map((name) => name.replace(/\s+/g, "_")).join("+");
  if (!scheduledIso) return `/todo@${memberPart} `;
  const [y, m, d] = scheduledIso.split("-");
  return `/todo@${memberPart}@${d}.${m}.${y} `;
}

// Rewrite the marker behind one todo row after that row was edited, so the
// notes keep saying what the todo table says (otherwise the next entry save
// would reconcile the edit away). `previous` identifies the row as it was
// (assignee + title), `next` carries the new assignee, title and ISO date.
//
// A marker can name several members (`/todo@Anna+Ben task`), one row each.
// Editing one of them must leave the others alone, so such a marker is split:
// the remaining members keep the original marker and the edited row gets its
// own, separated by a <br> — markers must not share a line, since a title runs
// to the next tag or line break.
//
// Returns the new content, or null when no marker matches (the row is then
// simply updated on its own).
export function rewriteTodoMarker(content, previous, next) {
  if (!content) return null;
  const norm = (value) => (value || "").trim().toLowerCase();

  const buildMarker = (kind, names, scheduledIso, title) =>
    buildTodoTag(names, scheduledIso).replace(/^\/todo@/, `/${kind}@`) + title;

  const regex = createTodoRegex();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const [full, kind, tag, rawTitle] = match;
    if (norm(rawTitle) !== norm(previous.title)) continue;
    const { assignees, scheduled } = parseAssigneeTag(tag);
    const index = assignees.findIndex(
      (name) => norm(name) === norm(previous.assignee),
    );
    if (index === -1) continue;

    const edited = buildMarker(
      kind,
      [next.assignee],
      next.scheduled || null,
      next.title,
    );
    const others = assignees.filter((_, i) => i !== index);
    const replacement =
      others.length === 0
        ? edited
        : `${buildMarker(kind, others, scheduled, rawTitle.trim())}<br>${edited}`;

    return (
      content.slice(0, match.index) +
      replacement +
      content.slice(match.index + full.length)
    );
  }
  return null;
}

// Ziel markers: `/ziel@01.10.2026 Titel` — workspace goals authored inline in
// entry notes, parsed on save like todos. A Ziel always carries a date (the
// events table requires one), so a marker without a real date is ignored.
export function createZielRegex() {
  return /\/ziel@([^\s<]+)[ \t]+([^<\n]+)/g;
}

export function parseZielMarkers(content) {
  const out = [];
  if (!content) return out;
  const regex = createZielRegex();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const scheduled = dateTokenToIso(match[1]);
    if (!scheduled) continue;
    const title = match[2].trim();
    if (title) out.push({ title, scheduled });
  }
  return out;
}

export function buildZielTag(title, scheduledIso) {
  const [y, m, d] = scheduledIso.split("-");
  return `/ziel@${d}.${m}.${y} ${title}`;
}

// Wrap each todo/done/ziel line in a colour class span so it shows highlighted
// in the editor and in every rendered view. Styling is derived from the live
// marker prefix each time — never stored — so toggling state recolours
// automatically and legacy plain-text todos get styled too. Run AFTER
// sanitizeHtml; the wrappers it adds are stripped again by the next sanitize.
export function decorateTodos(html) {
  if (!html) return "";
  return String(html).replace(
    /\/(todo|done|ziel)@[^\s<]+[ \t]+[^<\n]+/g,
    (match, kind) => {
      const cls =
        kind === "done"
          ? "done-line"
          : kind === "ziel"
            ? "ziel-line"
            : "todo-line";
      return `<span class="${cls}">${match}</span>`;
    },
  );
}
