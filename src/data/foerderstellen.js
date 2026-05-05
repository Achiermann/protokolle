// Single source of truth for Förderstellen + their programs.
// Re-verify each source annually (open the URL, check that the patterns/dates
// still match) and bump `verifiedAt`. The Eingabefristen UI surfaces the oldest
// verifiedAt as a "Stand"-badge so stale data is visible.

const ZH_FEB_MAY_SEP_NOV = [
  { month: 2, day: 1 },
  { month: 5, day: 1 },
  { month: 9, day: 1 },
  { month: 11, day: 1 },
];

const WINTERTHUR_JAN_MAY_SEP_15 = [
  { month: 1, day: 15 },
  { month: 5, day: 15 },
  { month: 9, day: 15 },
];

const PROHELVETIA_MAR_SEP = [
  { month: 3, day: 1 },
  { month: 9, day: 1 },
];

// Schwyz publishes a fresh deadline calendar each year — extend annually.
const SCHWYZ_DEADLINES = ['2026-01-02', '2026-03-06', '2026-06-05', '2026-08-14', '2026-10-23'];

const FOUR_CATEGORIES = [
  'Konzerttournee Inland',
  'Konzerttournee Ausland',
  'Tonträgerproduktion',
  'Promotion und Diffusion',
];

export const SOURCES = [
  {
    sourceUrl:
      'https://www.zh.ch/de/sport-kultur/kultur/kulturfoerderung/kulturschaffende-projekte/musik.html',
    förderstelle: 'Fachstelle Kultur Kanton Zürich',
    kanton: 'Zürich',
    stadt: null,
    verifiedAt: '2026-04-30',
    programs: [
      {
        förderformat: 'Projektbeiträge',
        förderbereiche: FOUR_CATEGORIES,
        deadlines: { type: 'annual', monthDays: ZH_FEB_MAY_SEP_NOV },
      },
      {
        förderformat: 'Mehrjährige Förderung Gruppen',
        förderbereiche: FOUR_CATEGORIES,
        deadlines: { type: 'fixed', dates: ['2026-05-31'] },
      },
    ],
  },
  {
    sourceUrl:
      'https://stadt.winterthur.ch/themen/leben-in-winterthur/kultur/kulturfoerderung/projektfoerderung',
    förderstelle: 'Kulturförderung Stadt Winterthur',
    kanton: 'Zürich',
    stadt: 'Winterthur',
    verifiedAt: '2026-04-30',
    programs: [
      {
        förderformat: 'Projekt-/Programmbeitrag (Konzerte in Winterthur)',
        förderbereiche: ['Konzerttournee Inland'],
        deadlines: { type: 'annual', monthDays: WINTERTHUR_JAN_MAY_SEP_15 },
      },
      {
        förderformat: 'Produktionsbeitrag',
        förderbereiche: ['Tonträgerproduktion', 'Promotion und Diffusion'],
        deadlines: { type: 'annual', monthDays: WINTERTHUR_JAN_MAY_SEP_15 },
      },
      {
        förderformat: 'Tourneebeitrag',
        förderbereiche: ['Konzerttournee Inland', 'Konzerttournee Ausland'],
        deadlines: { type: 'annual', monthDays: WINTERTHUR_JAN_MAY_SEP_15 },
      },
    ],
  },
  {
    sourceUrl:
      'https://www.stadt-zuerich.ch/de/stadtleben/kultur/kultur-foerdern/uebersicht-foerdermassnahmen/musikproduktionsbeitrag-jazz-rock-pop.html',
    förderstelle: 'Stadt Zürich Kulturförderung',
    kanton: 'Zürich',
    stadt: 'Zürich',
    verifiedAt: '2026-04-30',
    programs: [
      {
        förderformat: 'Musikproduktionsbeitrag Jazz/Rock/Pop',
        förderbereiche: ['Tonträgerproduktion', 'Promotion und Diffusion'],
        deadlines: { type: 'annual', monthDays: ZH_FEB_MAY_SEP_NOV },
      },
      {
        förderformat: 'Live-Beitrag Jazz/Rock/Pop',
        förderbereiche: ['Konzerttournee Inland', 'Konzerttournee Ausland'],
        deadlines: { type: 'annual', monthDays: ZH_FEB_MAY_SEP_NOV },
      },
    ],
  },
  {
    sourceUrl:
      'https://www.sz.ch/bildungsdepartement/amt-fuer-kultur/kulturfoerderung/beitraege-und-foerderung/beitragsgesuche.html/8756-8758-8802-9466-9471-9923-9992-9993',
    förderstelle: 'Kulturförderung Kanton Schwyz',
    kanton: 'Schwyz',
    stadt: null,
    verifiedAt: '2026-04-30',
    programs: [
      {
        förderformat: 'Beitragsgesuche',
        förderbereiche: [
          'Konzerttournee Inland',
          'Konzerttournee Ausland',
          'Tonträgerproduktion',
        ],
        deadlines: { type: 'fixed', dates: SCHWYZ_DEADLINES },
      },
    ],
  },
  {
    sourceUrl: 'https://engagement.migros.ch/de/foerderung-beantragen/kulturprozent-migros-zuerich',
    förderstelle: 'Migros Kulturprozent Zürich',
    kanton: 'Zürich',
    stadt: 'Zürich',
    verifiedAt: '2026-04-30',
    programs: [
      {
        förderformat: 'Kulturprozent (ganzjährig, 6 Wochen vor Veranstaltung)',
        förderbereiche: ['Konzerttournee Inland'],
        deadlines: { type: 'open' },
      },
    ],
  },
  {
    sourceUrl: 'https://prohelvetia.ch/de/foerderung-finden/kreation-und-produktion-aktuelle-musik/',
    förderstelle: 'Pro Helvetia',
    kanton: null,
    stadt: null,
    verifiedAt: '2026-04-30',
    programs: [
      {
        förderformat: 'Kreation und Produktion: aktuelle Musik',
        förderbereiche: ['Tonträgerproduktion', 'Promotion und Diffusion'],
        deadlines: { type: 'annual', monthDays: PROHELVETIA_MAR_SEP },
      },
    ],
  },
];

function generateDeadlines(spec, today) {
  if (spec.type === 'open') return null;
  if (spec.type === 'annual') {
    const startYear = parseInt(today.slice(0, 4), 10);
    const result = [];
    for (let y = startYear; y <= startYear + 1; y++) {
      for (const { month, day } of spec.monthDays) {
        const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (iso >= today) result.push(iso);
      }
    }
    return result.sort();
  }
  if (spec.type === 'fixed') {
    return spec.dates.filter((d) => d >= today).sort();
  }
  throw new Error(`Unknown deadline type: ${spec.type}`);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function getFoerderungen(today = todayIso()) {
  return SOURCES.flatMap((source, sIdx) =>
    source.programs.map((p, pIdx) => ({
      id: `${sIdx}-${pIdx}`,
      förderstelle: source.förderstelle,
      kanton: source.kanton,
      stadt: source.stadt,
      förderformat: p.förderformat,
      förderbereiche: p.förderbereiche,
      eingabefristen: generateDeadlines(p.deadlines, today),
      source_url: source.sourceUrl,
      verifiedAt: source.verifiedAt,
    }))
  );
}

// Returns the oldest verifiedAt across all sources — i.e. worst-case staleness.
export function getOldestVerifiedAt() {
  if (SOURCES.length === 0) return null;
  return SOURCES.map((s) => s.verifiedAt)
    .filter(Boolean)
    .sort()[0];
}
