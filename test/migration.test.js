const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

process.env.SUPABASE_DISABLED = 'true';
const { passwordHash, verifyPassword } = require('../server');

async function startServer(dataFile, adminPassword) {
  const port = 33000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: dataFile,
      UPLOAD_DIR: path.join(path.dirname(dataFile), 'uploads'),
      ADMIN_PASSWORD: adminPassword,
      SUPABASE_DISABLED: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`서버 시작 시간 초과\n${stderr}`));
    }, 10000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Hackathon Stage')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`서버가 종료되었습니다: ${code}\n${stderr}`));
    });
  });
  return { child, baseUrl: `http://127.0.0.1:${port}` };
}

function legacyDatabase(adminPassword) {
  return {
    event: {
      title: 'NEXT WAVE HACKATHON',
      subtitle: 'Demo Day · Seoul 2026',
      votingOpen: false,
      activeTeamId: null,
      schemaVersion: 2,
      updatedAt: new Date().toISOString()
    },
    teams: [{ id: 'team_legacy', name: '기존 팀', code: 'LEGACY26', color: '#7657ff', order: 1 }],
    users: [{
      id: 'user_operator',
      name: '관리자',
      email: 'admin@hackathon.kr',
      passwordHash: passwordHash(adminPassword),
      role: 'operator',
      teamId: null
    }],
    presentations: [{
      id: 'presentation_legacy',
      teamId: 'team_legacy',
      title: '기존 발표',
      summary: '기존에 공개되어 있던 발표입니다.',
      details: '',
      category: 'ETC',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedBy: 'user_operator'
    }],
    materials: [],
    operatorReviews: [{
      id: 'review_legacy',
      teamId: 'team_legacy',
      userId: 'user_operator',
      scores: { originality: 5, completion: 4, impact: 3, presentation: 2 },
      comment: '기존 심사 의견',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }],
    votes: []
  };
}

async function login(baseUrl, password) {
  return fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hackathon.kr', password })
  });
}

test('이전 데모 관리자 비밀번호를 환경 변수 값으로 교체한다', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hackathon-vote-migration-'));
  const dataFile = path.join(tempDir, 'database.json');
  const replacementPassword = 'Replacement-Password-2026!';
  await fs.writeFile(dataFile, JSON.stringify(legacyDatabase('admin1234')));
  const server = await startServer(dataFile, replacementPassword);
  try {
    assert.equal((await login(server.baseUrl, 'admin1234')).status, 401);
    assert.equal((await login(server.baseUrl, replacementPassword)).status, 200);
    const migrated = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    assert.equal(migrated.event.schemaVersion, 7);
    assert.equal(verifyPassword(replacementPassword, migrated.users[0].passwordHash), true);
    assert.equal(migrated.operatorReviews.length, 0);
    assert.equal(migrated.teams[0].evaluatorOnly, false);
    assert.equal(migrated.presentations[0].published, true);
  } finally {
    server.child.kill('SIGTERM');
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('사용자가 변경한 관리자 비밀번호는 마이그레이션 후에도 유지한다', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hackathon-vote-migration-'));
  const dataFile = path.join(tempDir, 'database.json');
  const customPassword = 'Already-Custom-Password!';
  await fs.writeFile(dataFile, JSON.stringify(legacyDatabase(customPassword)));
  const server = await startServer(dataFile, 'Ignored-Replacement-2026!');
  try {
    assert.equal((await login(server.baseUrl, customPassword)).status, 200);
    assert.equal((await login(server.baseUrl, 'Ignored-Replacement-2026!')).status, 401);
    const migrated = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    assert.equal(migrated.event.schemaVersion, 7);
    assert.equal(verifyPassword(customPassword, migrated.users[0].passwordHash), true);
  } finally {
    server.child.kill('SIGTERM');
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
