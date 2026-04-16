import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const envText = readFileSync(join(ROOT, '.env.local'), 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const input = `
## posteingang
probestrategie & termine (stichwort sectionproben)
livevideo nach tour
finalisierung video

## struktur
absegnung der statuten / OSS befragung (b)
lange und physische meetings
label / partnerschaften
thema diverse songwriter (r)
slack? (b)
struktur bedürfnisse db (b)
struktur sitzungsprotokolle
dropbox oder infomaniac? (ethik, USA-unabhängigkeit) (b)
einhaltung der 3-2-1 regel (b)

## timeline
sessions und sitzungen ab juni (b)
booking (b)
ausblick 2027 (b)
zukünftigen projekten vorausschauend raum geben
tourplanung produktion / set
EPK / promo / kommunikation nach aussen
sessions & meeting
release / EP / album
ziele / pläne für 2027
casa fuorn 2.0 (2026?)

## live
tourplakat

## produktion
studio session struktur: effizienz, bedürfnisse, p-split etc (b)
zwischenziele album (b)
feedback/listening session (b)
weiteres produktionsvorgehen weiter (ggf. zu ende) denken
drums und vocals rec? (r)
session notes & service point workflow (b)
mixing vision res (r)
selbständiges arbeiten beda (logic oder ableton?) (b)
finanzierung (r)
pullis von karin (b)

## projekt: livevideo
debriefing videosession und konklusion beda (planung voraus)
`;

const rows = [];
let currentTopic = null;
let currentProject = null;

for (const raw of input.split('\n')) {
  const line = raw.trim();
  if (!line) continue;

  if (line.startsWith('## ')) {
    const heading = line.slice(3).trim().toLowerCase();
    if (heading.startsWith('projekt:')) {
      currentProject = heading.slice('projekt:'.length).trim();
      currentTopic = null;
    } else {
      currentTopic = heading;
      currentProject = null;
    }
    continue;
  }

  rows.push({
    item_title: line.toLowerCase(),
    content: null,
    topic: currentTopic,
    project: currentProject,
    members: [],
  });
}

console.log(`Inserting ${rows.length} traktanden...`);
for (const r of rows) {
  console.log(`  • ${r.item_title}  [${r.topic ? 'topic=' + r.topic : 'project=' + r.project}]`);
}

const { data, error } = await supabase
  .schema('protokoll_app')
  .from('entries')
  .insert(rows)
  .select();

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(`Inserted ${data.length} rows.`);
