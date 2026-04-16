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

const lower = (v) => (typeof v === 'string' ? v.toLowerCase() : v);

async function lowercaseTable(table, fields) {
  const { data, error } = await supabase.schema('protokoll_app').from(table).select('*');
  if (error) throw error;
  console.log(`${table}: ${data.length} rows`);
  for (const row of data) {
    const patch = {};
    for (const f of fields) {
      const val = row[f];
      if (Array.isArray(val)) patch[f] = val.map(lower);
      else if (typeof val === 'string') patch[f] = val.toLowerCase();
    }
    if (Object.keys(patch).length === 0) continue;
    const { error: upErr } = await supabase
      .schema('protokoll_app')
      .from(table)
      .update(patch)
      .eq('id', row.id);
    if (upErr) throw upErr;
  }
}

async function main() {
  await lowercaseTable('entries', ['item_title', 'content', 'topic', 'project', 'members']);
  await lowercaseTable('todos', ['title', 'topic', 'project']);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
