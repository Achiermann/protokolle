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
// the assignee stops at whitespace or the next tag, the title stops at a line
// break or the next tag boundary.
export function createTodoRegex() {
  return /\/(todo|done)@([^\s<]+)[ \t]+([^<\n]+)/g;
}

export function createTodoCountRegex() {
  return /\/todo@[^\s<]+[ \t]+[^<\n]+/g;
}

// Wrap each todo/done line in a colour class span so it shows highlighted in the
// editor and in every rendered view. Styling is derived from the live `/todo` or
// `/done` prefix each time — never stored — so toggling state recolours
// automatically and legacy plain-text todos get styled too. Run AFTER
// sanitizeHtml; the wrappers it adds are stripped again by the next sanitize.
export function decorateTodos(html) {
  if (!html) return "";
  return String(html).replace(
    /\/(todo|done)@[^\s<]+[ \t]+[^<\n]+/g,
    (match, kind) => {
      const cls = kind === "done" ? "done-line" : "todo-line";
      return `<span class="${cls}">${match}</span>`;
    },
  );
}
