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
