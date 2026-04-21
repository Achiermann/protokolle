import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const UA = 'Mozilla/5.0 (compatible; ProtokolleScraper/1.0)';

// --- env loading (same pattern as seed-from-protokolle.mjs) ---
const envText = readFileSync(join(ROOT, '.env.local'), 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// --- date helpers ---
const MONTHS = {
  januar: 1, februar: 2, märz: 3, marz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

function toISO(day, month, year) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function nextOccurrenceISO(day, month, from = new Date()) {
  const y = from.getFullYear();
  const todayISO = from.toISOString().slice(0, 10);
  let iso = toISO(day, month, y);
  if (iso < todayISO) iso = toISO(day, month, y + 1);
  return iso;
}

function parseRecurringDates(str) {
  const results = [];
  const re = /(\d{1,2})\.\s*(Januar|Februar|März|Marz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b(?!\s*20\d{2})/gi;
  let m;
  while ((m = re.exec(str)) !== null) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) results.push({ day: parseInt(m[1], 10), month });
  }
  return results;
}

function parseExplicitDates(str) {
  const results = [];
  const re = /(\d{1,2})\.\s*(Januar|Februar|März|Marz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*(20\d{2})/gi;
  let m;
  while ((m = re.exec(str)) !== null) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) results.push(toISO(parseInt(m[1], 10), month, parseInt(m[3], 10)));
  }
  return results;
}

function dedupRecurring(arr) {
  const map = new Map();
  for (const r of arr) map.set(`${r.month}-${r.day}`, r);
  return [...map.values()];
}

// --- scrapers ---

async function scrapeStadtZurich() {
  const url =
    'https://www.stadt-zuerich.ch/de/stadtleben/kultur/kultur-foerdern/uebersicht-foerdermassnahmen/musikproduktionsbeitrag-jazz-rock-pop.html';
  const html = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const m = html.match(/Eingabefrist[^<]*<\/strong>\s*([^<]+)/i);
  const recurring = dedupRecurring(parseRecurringDates(m ? m[1] : ''));
  return recurring.map(({ day, month }) => ({
    förderstelle: 'Stadt Zürich Kulturförderung',
    kanton: 'Zürich',
    stadt: 'Zürich',
    einsendeschluss: nextOccurrenceISO(day, month),
    förderbereiche: 'Musik (Jazz/Rock/Pop)',
    förderformat: 'Musikproduktionsbeitrag Jazz/Rock/Pop',
  }));
}

async function scrapeKantonSchwyz() {
  const url =
    'https://www.sz.ch/bildungsdepartement/amt-fuer-kultur/kulturfoerderung/beitraege-und-foerderung/beitragsgesuche.html/8756-8758-8802-9466-9471-9923-9992-9993';
  const html = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  // Block layout: "Eingabeschlussdaten Eingabeschluss Sitzungstermine <5 deadline dates> <5 meeting dates>"
  const startIdx = text.indexOf('Eingabeschlussdaten');
  const endIdx = text.indexOf('Sidebar', Math.max(0, startIdx));
  const chunk = startIdx >= 0 ? text.slice(startIdx, endIdx > startIdx ? endIdx : startIdx + 2000) : '';
  const allDates = parseExplicitDates(chunk);
  // First half are Eingabeschluss, second half are Sitzungstermine
  const eingabeDates = allDates.slice(0, Math.ceil(allDates.length / 2));
  const today = new Date().toISOString().slice(0, 10);
  return eingabeDates
    .filter((d) => d >= today)
    .map((d) => ({
      förderstelle: 'Kulturförderung Kanton Schwyz',
      kanton: 'Schwyz',
      stadt: null,
      einsendeschluss: d,
      förderbereiche: 'Kultur',
      förderformat: 'Beitragsgesuche',
    }));
}

async function scrapeProHelvetia() {
  const res = await fetch('https://prohelvetia.ch/wp-json/ph/v1/funding-opportunities?lang=de');
  const data = await res.json();
  const wanted = new Set(['Internationale Präsenz', 'Kreation und Produktion: aktuelle Musik']);
  const rows = [];

  for (const f of data) {
    if (!wanted.has(f.title)) continue;
    const disciplines = (f.disciplineNames || []).join(', ') || null;
    const baseRow = {
      förderstelle: 'Pro Helvetia',
      kanton: null,
      stadt: null,
      förderbereiche: disciplines,
      förderformat: f.title,
    };

    if (f.submissionDeadline === 'Ganzjährig offen') {
      rows.push({ ...baseRow, einsendeschluss: null });
      continue;
    }

    const c = f.content || '';
    // Anchor on the bottom "Eingabetermine und Entscheidfristen" section — "Eingabedatum"
    // also appears in the top summary, which drags the capture into unrelated prose.
    const section = c.match(/Eingabetermine und Entscheidfristen([\s\S]*?)(?:Entscheidungsprozesse|$)/);
    const m = section ? section[1].match(/Eingabedatum([\s\S]*?)(?:Eröffnung|Frühestes|$)/) : null;
    const block = m ? m[1] : '';
    const recurring = dedupRecurring(parseRecurringDates(block));

    if (recurring.length === 0) {
      rows.push({ ...baseRow, einsendeschluss: null });
    } else {
      for (const { day, month } of recurring) {
        rows.push({ ...baseRow, einsendeschluss: nextOccurrenceISO(day, month) });
      }
    }
  }
  return rows;
}

async function scrapeMigros() {
  // No fixed deadline; "ganzjährig" — applications must arrive ≥6 weeks before event.
  return [
    {
      förderstelle: 'Migros Kulturprozent Zürich',
      kanton: 'Zürich',
      stadt: 'Zürich',
      einsendeschluss: null,
      förderbereiche: 'Kultur',
      förderformat: 'Kulturprozent (ganzjährig, 6 Wochen vor Veranstaltung)',
    },
  ];
}

// --- main ---
async function main() {
  console.log('Scraping sources…');
  const [sz, ks, ph, mg] = await Promise.all([
    scrapeStadtZurich(),
    scrapeKantonSchwyz(),
    scrapeProHelvetia(),
    scrapeMigros(),
  ]);
  const rows = [...sz, ...ks, ...ph, ...mg];

  console.log(`\nCollected ${rows.length} rows:`);
  for (const r of rows) {
    console.log(`  • ${r.förderstelle} | ${r.förderformat} | ${r.einsendeschluss ?? '(ganzjährig)'}`);
  }

  if (rows.length === 0) {
    console.log('Nothing to insert.');
    return;
  }

  if (process.env.DRY_RUN === '1') {
    console.log('\nDRY_RUN=1 — skipping DB write.');
    return;
  }

  // Wipe per-förderstelle then insert fresh rows
  const förderstellen = [...new Set(rows.map((r) => r.förderstelle))];
  for (const f of förderstellen) {
    const del = await supabase
      .schema('orgaprof')
      .from('förderungen')
      .delete()
      .eq('förderstelle', f);
    if (del.error) console.warn(`delete ${f} warning:`, del.error.message);
  }

  console.log(`\nInserting ${rows.length} rows into orgaprof.förderungen…`);
  const { data, error } = await supabase
    .schema('orgaprof')
    .from('förderungen')
    .insert(rows)
    .select();
  if (error) throw error;
  console.log(`Inserted ${data.length} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
