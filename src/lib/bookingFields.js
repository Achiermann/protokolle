// Field catalogue of a booking gig, shared by the API (whitelists) and the UI.
// A new gig is created from this "footprint" (the Winterthur gig's shape):
// every field present, every value empty.

export const SHOW_TEXT_FIELDS = [
  "label",
  "event_name",
  "hosting",
  "deal",
  "ticket_price",
  "schedule",
  "set_length",
  "line_up",
  "dinner",
  "accommodation",
  "tech_person",
  "merch_person",
  "tech_notes",
  "notes",
  "payout",
  "parking",
  "accommodation_label",
  "accommodation_address",
];

export const VENUE_TEXT_FIELDS = [
  "name",
  "city",
  "address",
  "contact_name",
  "contact_email",
  "tech_specs",
  "notes",
];

// Internal checklists (Intern only, never in Public or the PDF).
export const CHECKLISTS = [
  {
    title: "Checkliste Tech",
    items: [
      { key: "rider", label: "Rider" },
      { key: "parkplatz", label: "Parkplatz" },
    ],
  },
  {
    title: "Checkliste Promo",
    items: [
      { key: "bild", label: "Bild" },
      { key: "bio", label: "Bio" },
      { key: "social_links", label: "Social Links" },
      { key: "hoerprobe", label: "Hörprobe" },
      { key: "website", label: "Website" },
      { key: "video", label: "Video" },
    ],
  },
];

export const CHECKLIST_KEYS = CHECKLISTS.flatMap((list) =>
  list.items.map((item) => item.key),
);

// Placeholder name of the venue a new gig starts with.
export const NEW_VENUE_NAME = "Neue Venue";
