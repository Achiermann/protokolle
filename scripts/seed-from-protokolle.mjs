import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROTOKOLLE_DIR = join(ROOT, 'public', 'protokolle nach töpfen');

// --- env loading ---
const envText = readFileSync(join(ROOT, '.env.local'), 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// --- RTF → plain text ---
function stripBalancedGroup(s, startRegex) {
  while (true) {
    const m = s.match(startRegex);
    if (!m) return s;
    const start = m.index;
    let depth = 0;
    let i = start;
    for (; i < s.length; i++) {
      const ch = s[i];
      if (ch === '\\' && (s[i + 1] === '{' || s[i + 1] === '}')) {
        i++;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    s = s.slice(0, start) + s.slice(i);
  }
}

function rtfToText(rtf) {
  let s = rtf;
  s = stripBalancedGroup(s, /\{\\fonttbl/);
  s = stripBalancedGroup(s, /\{\\colortbl/);
  s = stripBalancedGroup(s, /\{\\\*\\expandedcolortbl/);
  s = stripBalancedGroup(s, /\{\\\*\\listtable/);
  s = stripBalancedGroup(s, /\{\\\*\\listoverridetable/);

  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => {
    const code = parseInt(h, 16);
    // cp1252/latin-1 mapping good enough for our files
    return String.fromCharCode(code);
  });
  s = s.replace(/\\u(-?\d+)\s?\??/g, (_, n) => {
    const code = parseInt(n, 10);
    return String.fromCharCode(code < 0 ? code + 0x10000 : code);
  });

  s = s.replace(/\\line\b/g, '\n').replace(/\\par\b/g, '\n');
  s = s.replace(/\\\n/g, '\n');
  s = s.replace(/\\\\/g, '\\');
  s = s.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
  s = s.replace(/\\[a-zA-Z]+-?\d*\s?/g, '');
  s = s.replace(/\\\*/g, '');
  s = s.replace(/[{}]/g, '');
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  // Rejoin hash markers split across tokens (e.g., "#\ntraktandum")
  s = s.replace(/#\s+(traktandum|thema|project|projekt|date)/gi, '#$1');
  return s.trim();
}

// --- parsing helpers ---
function parseDate(str) {
  const m = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`).toISOString();
}

function extractHeader(text) {
  const firstTraktIdx = text.search(/#traktandum/i);
  const header = firstTraktIdx >= 0 ? text.slice(0, firstTraktIdx) : text;

  let project = null;
  let topic = null;

  const projMatch = header.match(/#project[s_]?[:\s]+([^\n]+)/i);
  const projektMatch = header.match(/#projekt[_:\s]+([^\n]+)/i);
  const themaMatch = header.match(/#thema[:\s]+([^\n]+)/i);

  if (projMatch) project = projMatch[1].trim().toLowerCase();
  else if (projektMatch) project = projektMatch[1].trim().toLowerCase();

  if (themaMatch) topic = themaMatch[1].trim().toLowerCase();

  const headerDate = parseDate(header);
  return { project, topic, headerDate };
}

function extractTraktanden(text, fallbackDate) {
  const results = [];
  const regex = /#traktandum\b/gi;
  const positions = [];
  let m;
  while ((m = regex.exec(text)) !== null) positions.push(m.index);

  let currentDate = fallbackDate;

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : text.length;
    const chunk = text.slice(start, end);

    // chunk starts with "#traktandum..." — grab title up to newline
    const afterMarker = chunk.replace(/^#traktandum\s*/i, '');
    const nl = afterMarker.indexOf('\n');
    let rawTitle = nl >= 0 ? afterMarker.slice(0, nl) : afterMarker;
    let rest = nl >= 0 ? afterMarker.slice(nl + 1) : '';

    // Inline #date in title line?
    const inlineDate = rawTitle.match(/#date\s*([0-9.]+)/i);
    if (inlineDate) {
      const d = parseDate(inlineDate[1]);
      if (d) currentDate = d;
      rawTitle = rawTitle.replace(/#date\s*[0-9.]*/i, '').trim();
    }

    // #date line inside content block
    const contentDateMatch = rest.match(/#date\s*([0-9.]+)/i);
    if (contentDateMatch) {
      const d = parseDate(contentDateMatch[1]);
      if (d) currentDate = d;
      rest = rest.replace(/#date\s*[0-9.]*/i, '').trim();
    }

    // Strip "to do:" sections (per NS.md: ignore todos)
    rest = rest.replace(/(^|\n)\s*to ?do\s*:?[\s\S]*?(?=\n\s*#|$)/i, '\n').trim();

    const title = rawTitle.replace(/\s+/g, ' ').trim();
    if (!title) continue;

    results.push({
      item_title: title,
      content: rest || null,
      date_created: currentDate,
    });
  }

  return results;
}

// --- main ---
async function main() {
  console.log('Deleting existing rows in protokoll_app.entries and protokoll_app.todos...');
  const delTodos = await supabase
    .schema('protokoll_app')
    .from('todos')
    .delete()
    .not('id', 'is', null);
  if (delTodos.error) console.warn('todos delete warning:', delTodos.error.message);

  const delEntries = await supabase
    .schema('protokoll_app')
    .from('entries')
    .delete()
    .not('id', 'is', null);
  if (delEntries.error) throw delEntries.error;

  const files = readdirSync(PROTOKOLLE_DIR).filter((f) => f.toLowerCase().endsWith('.rtf'));

  const rows = [];
  for (const file of files) {
    const text = rtfToText(readFileSync(join(PROTOKOLLE_DIR, file), 'utf8'));
    const { project, topic, headerDate } = extractHeader(text);
    const traktanden = extractTraktanden(text, headerDate || new Date().toISOString());

    console.log(`\n${file}  →  project=${project || '-'}  topic=${topic || '-'}  (${traktanden.length} traktanden)`);

    for (const t of traktanden) {
      rows.push({
        item_title: t.item_title,
        content: t.content,
        project,
        topic,
        date_created: t.date_created,
        members: [],
      });
      console.log(`  • ${t.item_title}  [${t.date_created?.slice(0, 10) || '-'}]`);
    }
  }

  if (rows.length === 0) {
    console.log('No rows to insert.');
    return;
  }

  console.log(`\nInserting ${rows.length} rows...`);
  const { data, error } = await supabase
    .schema('protokoll_app')
    .from('entries')
    .insert(rows)
    .select();
  if (error) throw error;
  console.log(`Inserted ${data.length} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
