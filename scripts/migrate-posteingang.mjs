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

// Since we can't run raw SQL via anon key, we use the REST API workaround:
// We'll check if the column exists, and if not, instruct the user.
const { data, error } = await supabase
  .schema('protokoll_app')
  .from('entries')
  .select('in_posteingang')
  .limit(1);

if (error && error.message.includes('does not exist')) {
  console.log('Column "in_posteingang" does not exist yet.');
  console.log('Please run this SQL in your Supabase SQL Editor:\n');
  console.log('ALTER TABLE protokoll_app.entries ADD COLUMN IF NOT EXISTS in_posteingang BOOLEAN NOT NULL DEFAULT false;');
  process.exit(1);
} else if (error) {
  console.error(error);
  process.exit(1);
} else {
  console.log('Column "in_posteingang" already exists. No action needed.');
}
