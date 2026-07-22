const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const table = process.env.SUPABASE_STATE_TABLE || 'hackathon_state';
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'presentation-materials';

if (!url || !key) {
  console.error('.env에 SUPABASE_URL과 SUPABASE_SECRET_KEY를 설정해 주세요.');
  process.exitCode = 1;
  return;
}

async function check() {
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { error: tableError } = await supabase.from(table).select('id').limit(1);
  if (tableError) throw new Error(`테이블 접근 실패: ${tableError.message}`);

  const { error: bucketError } = await supabase.storage.getBucket(bucket);
  if (bucketError) throw new Error(`Storage 버킷 접근 실패: ${bucketError.message}`);

  console.log(`Supabase 연결 정상: ${table} 테이블 / ${bucket} 버킷`);
}

check().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
