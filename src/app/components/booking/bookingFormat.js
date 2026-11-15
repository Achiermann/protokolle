import { NEW_VENUE_NAME } from "@/lib/bookingFields";

// Shared formatting helpers for the booking app.

// 'YYYY-MM-DD' → local Date (no UTC shift).
export const parseIsoDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const formatDateLong = (iso) =>
  parseIsoDate(iso).toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const formatWeekdayShort = (iso) =>
  parseIsoDate(iso)
    .toLocaleDateString("de-CH", { weekday: "short" })
    .replace(".", "");

export const formatDayMonth = (iso) => {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
};

export const formatDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

export const formatMonthYear = (iso) =>
  parseIsoDate(iso).toLocaleDateString("de-CH", {
    month: "long",
    year: "numeric",
  });

export const splitLines = (text) =>
  (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

// Turns a free-text schedule into rows of { time, text } so times line up in
// their own column. Understands leading times ("16.45 Get-in", "2:00 PM: Get
// in", "ca 21.30 Soybomb") and trailing ones ("Einlass: 20.00 Uhr").
const TIME = String.raw`(?:ca\.?\s*)?~?\d{1,2}[.:]\d{2}(?:\s*(?:AM|PM|Uhr))?(?:\s*[-–]\s*(?:ca\.?\s*)?\d{1,2}[.:]\d{2}(?:\s*(?:AM|PM|Uhr))?)?`;
const LEADING = new RegExp(`^(${TIME})\\s*:?\\s*(.*)$`, "i");
const TRAILING = new RegExp(`^(.*?)\\s*:\\s*(${TIME})\\s*(.*)$`, "i");

export const parseSchedule = (text) =>
  splitLines(text).map((line) => {
    const lead = line.match(LEADING);
    if (lead) return { time: lead[1].trim(), text: lead[2].trim() };
    const trail = line.match(TRAILING);
    if (trail) {
      const rest = trail[3] ? ` ${trail[3]}` : "";
      return { time: trail[2].trim(), text: `${trail[1].trim()}${rest}` };
    }
    return { time: "", text: line };
  });

// "19.11.26"
export const formatDateShort = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
};

// Sheet/PDF heading: "19.11.26, Kraftfeld, Winterthur".
export const showHeading = (show, venue) =>
  [formatDateShort(show.show_date), showTitle(show, venue), venue?.city]
    .filter(Boolean)
    .join(", ");

// Venue/placeholder title for a show.
// A new gig's placeholder venue name counts as empty: Public and the PDF
// show only what was actually filled in.
const venueName = (venue) =>
  venue?.name && venue.name !== NEW_VENUE_NAME ? venue.name : "";

export const showTitle = (show, venue) => venueName(venue) || show.label || "";

export const mapsUrl = (venue) =>
  venue?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${venue.name}, ${venue.address.replace(/\n/g, ", ")}`,
      )}`
    : null;

const hasValue = (v) => v !== null && v !== undefined && v !== "";

// Single source of truth for what a show's Public page contains, shared by
// the on-screen Public sheet and the PDF. Empty rows and sections are
// dropped. Internal-only data (the Deal, the checklists) never appears here;
// the Intern sheet has its own field list (InternSheet.js).
//   facts    → rows of { label, lines, links? }
//   schedule → rows of { time, text }
//   text     → one free-text block
export const buildShowSections = (show, venue) => {
  const fact = (label, value, links) =>
    hasValue(value) || links?.length
      ? { label, lines: splitLines(String(value ?? "")), links: links || [] }
      : null;
  const facts = (key, title, rows) => {
    const kept = rows.filter(Boolean);
    return kept.length ? { key, title, type: "facts", rows: kept } : null;
  };

  const techSpecs = [venue?.tech_specs, show.tech_notes]
    .filter(Boolean)
    .join("\n\n");
  const schedule = (show.schedule_items || []).filter(
    (row) => row.time || row.text,
  );

  // The venue (name + address) is not a section: it sits right under the
  // title (showVenue below).
  return [
    schedule.length
      ? { key: "schedule", title: "Schedule", type: "schedule", rows: schedule }
      : null,
    facts("kontakte", "Kontakte", [
      fact(
        "Kontakt",
        venue?.contact_name,
        venue?.contact_email
          ? [
              {
                kind: "mail",
                href: `mailto:${venue.contact_email}`,
                text: venue.contact_email,
              },
            ]
          : [],
      ),
    ]),
    facts("team", "Line-Up & Team", [
      fact("Line-Up", show.line_up),
      fact("Technik", show.tech_person),
      fact("Merch", show.merch_person),
    ]),
    // Left side is free text ("Hotel", "Bei Dany", …), right the address.
    // Only an address → "Unterkunft: <address>"; only a label → "Unterkunft:
    // <label>", so nothing empty is ever shown.
    facts("uebernachtung", "Übernachtung", [
      hasValue(show.accommodation_address)
        ? fact(
            show.accommodation_label || "Unterkunft",
            show.accommodation_address,
          )
        : fact("Unterkunft", show.accommodation_label),
      fact("Info", show.accommodation),
    ]),
    techSpecs
      ? {
          key: "tech",
          title: "Pult / Tech Specs",
          type: "text",
          text: techSpecs,
        }
      : null,
    facts("sonstiges", "Sonstige Infos", [
      fact("Eintritt", show.ticket_price),
      fact(
        "Travel Party",
        hasValue(show.travel_party) ? `${show.travel_party} Personen` : null,
      ),
      fact("Hosting", show.hosting),
      fact("Dinner", show.dinner),
      fact("Parkplätze", show.parking),
      fact("Gage", show.payout),
    ]),
    show.notes
      ? { key: "notes", title: "Notizen", type: "text", text: show.notes }
      : null,
  ].filter(Boolean);
};

// "Venue" block under the title: venue name, then the address lines, plus a
// map link when there is an address. null when there is nothing to show.
export const showVenue = (venue) => {
  const name = venueName(venue);
  const address = splitLines(venue?.address);
  if (!name && address.length === 0) return null;
  return {
    lines: [name, ...address].filter(Boolean),
    mapsUrl: address.length ? mapsUrl(venue) : null,
  };
};

// "19.11. Winterthur" — the short label of a show tab.
export const showTabLabel = (show, venue) =>
  `${formatDayMonth(show.show_date)} ${venue?.city || showTitle(show, venue)}`.trim();

export const safeFileName = (name) =>
  name
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

// Two-column sheet: which column each section sits in (0 = left, 1 = right).
// The left column opens with the Adresse block (rendered by the sheets).
// Fixed rather than auto-balanced, so a field is always found in the same
// place. Unknown keys go right.
// "full" sections span both columns below them (order: FULL_WIDTH_ORDER).
const SHEET_COLUMN = { schedule: 0, tech: "full", notes: "full" };

export const splitColumns = (sections) => [
  sections.filter((s) => SHEET_COLUMN[s.key] === 0),
  sections.filter((s) => SHEET_COLUMN[s.key] === undefined),
];

// Full-width sections at the bottom, in this order: Notizen, then Pult /
// Tech Specs.
const FULL_WIDTH_ORDER = ["notes", "tech"];

export const fullWidthSections = (sections) =>
  FULL_WIDTH_ORDER.map((key) => sections.find((s) => s.key === key)).filter(
    Boolean,
  );

// Multi-line text squeezed onto one line ("Max. 40min\n(incl.Encore)" →
// "Max. 40min (incl.Encore)"), for single-line blocks like Setlänge.
export const oneLine = (text) => splitLines(text).join(" ");

// Long free text (Notizen, Pult / Tech Specs) switches to two columns once it
// has more than this many lines.
export const LONG_TEXT_LINES = 10;

export const isLongText = (text) =>
  (text || "").split("\n").length > LONG_TEXT_LINES;

// Splits text lines into two halves for a two-column layout. Prefers a blank
// line near the middle so paragraphs ("Mixer\n1x …") stay together.
export const splitInTwo = (text) => {
  const lines = (text || "").split("\n");
  const mid = Math.ceil(lines.length / 2);
  let cut = mid;
  for (let d = 0; d <= 3; d += 1) {
    if (lines[mid + d]?.trim() === "") {
      cut = mid + d;
      break;
    }
    if (lines[mid - d]?.trim() === "") {
      cut = mid - d;
      break;
    }
  }
  const trim = (part) => {
    while (part.length && !part[0].trim()) part.shift();
    while (part.length && !part[part.length - 1].trim()) part.pop();
    return part;
  };
  return [trim(lines.slice(0, cut)), trim(lines.slice(cut))];
};
