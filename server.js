const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, 'data', 'uploads');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'database.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_MAX_AGE = 60 * 60 * 12;
const SUPABASE_DISABLED = process.env.SUPABASE_DISABLED === 'true';
const SUPABASE_URL = SUPABASE_DISABLED ? '' : process.env.SUPABASE_URL || '';
const SUPABASE_KEY = SUPABASE_DISABLED ? '' : process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STATE_TABLE = process.env.SUPABASE_STATE_TABLE || 'hackathon_state';
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'presentation-materials';
const SUPABASE_STATE_ID = 'main';

if (Boolean(SUPABASE_URL) !== Boolean(SUPABASE_KEY)) {
  throw new Error('SUPABASE_URL과 SUPABASE_SECRET_KEY(또는 SUPABASE_SERVICE_ROLE_KEY)를 모두 설정해 주세요.');
}

const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
}) : null;

const SESSION_SECRET = process.env.SESSION_SECRET || SUPABASE_KEY || crypto.randomBytes(32).toString('hex');
let db;
let writeQueue = Promise.resolve();
let apiRequestQueue = Promise.resolve();
let generatedAdminPassword = null;

const scoreKeys = [
  'problemValue',
  'goalSpecificity',
  'solutionFit',
  'solutionOriginality',
  'aiRelevance',
  'feasibility',
  'structuralCompleteness',
  'impactScalability',
  'pitchQuality',
  'attitudeDefense'
];
const legacyScoreMap = {
  problemValue: 'impact',
  goalSpecificity: 'impact',
  solutionFit: 'completion',
  solutionOriginality: 'originality',
  aiRelevance: 'originality',
  feasibility: 'completion',
  structuralCompleteness: 'presentation',
  impactScalability: 'impact',
  pitchQuality: 'presentation',
  attitudeDefense: 'presentation'
};
const materialMimeTypes = {
  '.pdf': 'application/pdf',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};
const allowedMaterialExtensions = new Set(Object.keys(materialMimeTypes));
const MAX_MATERIAL_SIZE = 10 * 1024 * 1024;

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, original] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(original, 'hex');
  return candidate.length === originalBuffer.length && crypto.timingSafeEqual(candidate, originalBuffer);
}

function passwordFingerprint(stored) {
  return crypto.createHash('sha256').update(stored).digest('base64url').slice(0, 16);
}

function createSessionToken(user) {
  const payload = Buffer.from(JSON.stringify({
    userId: user.id,
    password: passwordFingerprint(user.passwordHash),
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function sessionUser(token) {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.userId || session.expiresAt < Date.now()) return null;
    const user = db.users.find((item) => item.id === session.userId);
    if (!user || session.password !== passwordFingerprint(user.passwordHash)) return null;
    return user;
  } catch {
    return null;
  }
}

function sessionCookie(req, token, maxAge = SESSION_MAX_AGE) {
  const secure = process.env.VERCEL === '1'
    || process.env.NODE_ENV === 'production'
    || req.headers['x-forwarded-proto'] === 'https';
  return `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function seedDatabase() {
  const includeDemoData = process.env.SEED_DEMO_DATA === 'true';
  const demoTeams = [
    { id: 'team_nova', name: 'Team Nova', code: 'NOVA26', color: '#ff6b35', order: 1 },
    { id: 'team_pixel', name: 'Pixel Crew', code: 'PIXEL26', color: '#8b5cf6', order: 2 },
    { id: 'team_green', name: 'Green Loop', code: 'GREEN26', color: '#10b981', order: 3 },
    { id: 'team_bridge', name: 'Bridge Lab', code: 'BRIDGE26', color: '#0ea5e9', order: 4 }
  ];
  const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(15).toString('base64url');
  if (!process.env.ADMIN_PASSWORD) generatedAdminPassword = adminPassword;
  const demoUsers = [
    { id: 'user_nova', name: '이노바', email: 'nova@hackathon.kr', passwordHash: passwordHash('vote1234'), role: 'participant', teamId: 'team_nova' },
    { id: 'user_pixel', name: '박픽셀', email: 'pixel@hackathon.kr', passwordHash: passwordHash('vote1234'), role: 'participant', teamId: 'team_pixel' },
    { id: 'user_green', name: '최그린', email: 'green@hackathon.kr', passwordHash: passwordHash('vote1234'), role: 'participant', teamId: 'team_green' },
    { id: 'user_bridge', name: '정브릿지', email: 'bridge@hackathon.kr', passwordHash: passwordHash('vote1234'), role: 'participant', teamId: 'team_bridge' }
  ];
  return {
    event: {
      title: 'NEXT WAVE HACKATHON',
      subtitle: 'Demo Day · Seoul 2026',
      votingOpen: false,
      activeTeamId: null,
      schemaVersion: 5,
      updatedAt: new Date().toISOString()
    },
    teams: includeDemoData ? demoTeams : [],
    users: [
      { id: 'user_operator', name: '관리자', email: 'admin@hackathon.kr', passwordHash: passwordHash(adminPassword), role: 'operator', teamId: null },
      ...(includeDemoData ? demoUsers : [])
    ],
    presentations: [],
    materials: [],
    operatorReviews: [],
    votes: []
  };
}

function remoteError(operation, cause) {
  const error = new Error(`Supabase ${operation} 실패: ${cause.message}`);
  error.cause = cause;
  return error;
}

async function readStoredDatabase() {
  if (supabase) {
    const { data, error } = await supabase
      .from(SUPABASE_STATE_TABLE)
      .select('data')
      .eq('id', SUPABASE_STATE_ID)
      .maybeSingle();
    if (error) throw remoteError('데이터 조회', error);
    if (data?.data) return { database: data.data, needsSave: false, migrateLocalFiles: false };

    try {
      return { database: JSON.parse(await fs.readFile(DATA_FILE, 'utf8')), needsSave: true, migrateLocalFiles: true };
    } catch (localError) {
      if (localError.code !== 'ENOENT') throw localError;
      return { database: seedDatabase(), needsSave: true, migrateLocalFiles: false };
    }
  }

  try {
    return { database: JSON.parse(await fs.readFile(DATA_FILE, 'utf8')), needsSave: false, migrateLocalFiles: false };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { database: seedDatabase(), needsSave: true, migrateLocalFiles: false };
  }
}

async function loadDatabase() {
  let obsoleteMaterialFiles = [];
  const stored = await readStoredDatabase();
  db = stored.database;
  // 이전 버전 데이터도 현재 스키마로 안전하게 올린다.
  let migrated = stored.needsSave;
  if (!Object.hasOwn(db.event, 'activeTeamId')) {
    db.event.activeTeamId = null;
    migrated = true;
  }
  if (!db.event.activeTeamId && db.event.votingOpen) {
    db.event.votingOpen = false;
    migrated = true;
  }
  if (!Array.isArray(db.materials)) {
    db.materials = [];
    migrated = true;
  }
  if (Number(db.event.schemaVersion || 0) < 2) {
    const demoTeamIds = new Set(['team_nova', 'team_pixel', 'team_green', 'team_bridge']);
    obsoleteMaterialFiles = removeTeams(demoTeamIds);
    const demoUserIds = new Set(['user_nova', 'user_pixel', 'user_green', 'user_bridge']);
    db.users = db.users.filter((user) => !demoUserIds.has(user.id));
    db.votes = db.votes.filter((vote) => !demoUserIds.has(vote.userId));
    const operator = db.users.find((user) => user.id === 'user_operator');
    if (operator) operator.name = '관리자';
    db.event.schemaVersion = 2;
    migrated = true;
  }
  if (Number(db.event.schemaVersion || 0) < 3) {
    const operator = db.users.find((user) => user.role === 'operator');
    if (operator && verifyPassword('admin1234', operator.passwordHash)) {
      const replacementPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(15).toString('base64url');
      operator.passwordHash = passwordHash(replacementPassword);
      if (!process.env.ADMIN_PASSWORD) generatedAdminPassword = replacementPassword;
    }
    db.event.schemaVersion = 3;
    migrated = true;
  }
  if (Number(db.event.schemaVersion || 0) < 4) {
    for (const item of [...db.operatorReviews, ...db.votes]) {
      const previous = item.scores || {};
      if (scoreKeys.every((key) => Number.isInteger(Number(previous[key])))) continue;
      item.scores = Object.fromEntries(scoreKeys.map((key) => {
        const legacyValue = Number(previous[legacyScoreMap[key]]);
        return [key, Number.isInteger(legacyValue) && legacyValue >= 1 && legacyValue <= 5 ? legacyValue : 3];
      }));
    }
    for (const presentation of db.presentations) {
      if (!Object.hasOwn(presentation, 'details')) presentation.details = '';
    }
    db.event.schemaVersion = 4;
    migrated = true;
  }
  if (Number(db.event.schemaVersion || 0) < 5) {
    for (const review of db.operatorReviews) {
      if (!review.reviewerName) {
        review.reviewerName = db.users.find((user) => user.id === review.userId)?.name || '심사위원';
      }
      if (!review.createdBy) review.createdBy = review.userId || null;
    }
    db.event.schemaVersion = 5;
    migrated = true;
  }
  if (stored.migrateLocalFiles) await migrateLocalMaterialFiles();
  if (migrated) await saveDatabase();
  await deleteStoredFiles(obsoleteMaterialFiles);
}

function removeTeams(teamIds) {
  const removedUserIds = new Set(db.users.filter((user) => teamIds.has(user.teamId)).map((user) => user.id));
  const storedNames = db.materials.filter((material) => teamIds.has(material.teamId)).map((material) => material.storedName);
  db.teams = db.teams.filter((team) => !teamIds.has(team.id));
  db.users = db.users.filter((user) => !teamIds.has(user.teamId));
  db.presentations = db.presentations.filter((item) => !teamIds.has(item.teamId));
  db.materials = db.materials.filter((item) => !teamIds.has(item.teamId));
  db.operatorReviews = db.operatorReviews.filter((item) => !teamIds.has(item.teamId) && !removedUserIds.has(item.userId));
  db.votes = db.votes.filter((item) => !teamIds.has(item.teamId) && !removedUserIds.has(item.userId));
  if (teamIds.has(db.event.activeTeamId)) {
    db.event.activeTeamId = null;
    db.event.votingOpen = false;
  }
  return storedNames;
}

async function deleteStoredFiles(storedNames) {
  if (!storedNames.length) return;
  if (supabase) {
    const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove(storedNames);
    if (error) throw remoteError('파일 삭제', error);
    return;
  }
  await Promise.all(storedNames.map((storedName) => fs.unlink(path.join(UPLOAD_DIR, storedName)).catch((unlinkError) => {
    if (unlinkError.code !== 'ENOENT') throw unlinkError;
  })));
}

async function storeFile(storedName, fileBuffer, mimeType, upsert = false) {
  if (supabase) {
    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(storedName, fileBuffer, { contentType: mimeType, upsert });
    if (error) throw remoteError('파일 업로드', error);
    return;
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), fileBuffer, { flag: 'wx' });
}

async function migrateLocalMaterialFiles() {
  if (!supabase || !db.materials.length) return;
  for (const material of db.materials) {
    let file;
    try {
      file = await fs.readFile(path.join(UPLOAD_DIR, material.storedName));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Supabase 이전 실패: 로컬 발표자료 ${material.originalName}을(를) 찾을 수 없습니다.`);
      }
      throw error;
    }
    await storeFile(material.storedName, file, material.mimeType, true);
  }
}

async function readStoredFile(storedName) {
  if (supabase) {
    const { data, error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(storedName);
    if (error) {
      if (error.statusCode === '404' || error.status === 404) {
        const missing = new Error('저장된 파일을 찾을 수 없습니다.');
        missing.code = 'ENOENT';
        throw missing;
      }
      throw remoteError('파일 다운로드', error);
    }
    return Buffer.from(await data.arrayBuffer());
  }
  return fs.readFile(path.join(UPLOAD_DIR, storedName));
}

function saveDatabase() {
  const snapshot = JSON.parse(JSON.stringify(db));
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_STATE_TABLE).upsert({
        id: SUPABASE_STATE_ID,
        data: snapshot,
        updated_at: new Date().toISOString()
      });
      if (error) throw remoteError('데이터 저장', error);
      return;
    }
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temp = `${DATA_FILE}.tmp`;
    await fs.writeFile(temp, JSON.stringify(snapshot, null, 2));
    await fs.rename(temp, DATA_FILE);
  });
  return writeQueue;
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function error(res, status, message) {
  json(res, status, { error: message });
}

async function readBody(req, maxBytes = 200_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('요청 데이터가 너무 큽니다.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('올바르지 않은 JSON 형식입니다.');
  }
}

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').filter(Boolean).map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
    })
  );
}

function currentUser(req) {
  const token = cookies(req).session;
  return sessionUser(token);
}

function publicUser(user) {
  const team = db.teams.find((item) => item.id === user.teamId);
  return { id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId, teamName: team?.name || null };
}

function requireUser(req, res, role) {
  const user = currentUser(req);
  if (!user) {
    error(res, 401, '로그인이 필요합니다.');
    return null;
  }
  if (role && user.role !== role) {
    error(res, 403, '이 작업을 할 권한이 없습니다.');
    return null;
  }
  return user;
}

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function validateScores(body) {
  const scores = {};
  for (const key of scoreKeys) {
    const value = Number(body[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) return null;
    scores[key] = value;
  }
  return scores;
}

function averageScores(items) {
  if (!items.length) return { ...Object.fromEntries(scoreKeys.map((key) => [key, 0])), total: 0 };
  const averages = {};
  for (const key of scoreKeys) {
    averages[key] = items.reduce((sum, item) => sum + Number(item.scores[key] || 0), 0) / items.length;
  }
  averages.total = scoreKeys.reduce((sum, key) => sum + averages[key], 0) / scoreKeys.length;
  return averages;
}

function teamPayload(team, user, includeResults = false) {
  const presentation = db.presentations.find((item) => item.teamId === team.id) || null;
  const myVote = user ? db.votes.find((item) => item.teamId === team.id && item.userId === user.id) : null;
  const operatorReviews = db.operatorReviews.filter((item) => item.teamId === team.id);
  const votes = db.votes.filter((item) => item.teamId === team.id);
  const materials = db.materials
    .filter((item) => item.teamId === team.id)
    .map(({ id, originalName, mimeType, size, createdAt }) => ({ id, originalName, mimeType, size, createdAt }));
  const payload = {
    id: team.id,
    name: team.name,
    ...(user?.role === 'operator' ? { code: team.code } : {}),
    color: team.color,
    order: team.order,
    published: Boolean(presentation),
    presentation,
    materials,
    isOwnTeam: user?.teamId === team.id,
    isActive: db.event.activeTeamId === team.id,
    eligible: user?.role === 'participant'
      && user.teamId !== team.id
      && db.event.activeTeamId === team.id
      && db.event.votingOpen
      && Boolean(presentation),
    myVote: myVote ? { scores: myVote.scores, comment: myVote.comment, updatedAt: myVote.updatedAt } : null,
    participantVoteCount: votes.length,
    operatorReviewCount: operatorReviews.length
  };
  if (includeResults) {
    const participantAverage = averageScores(votes);
    const operatorAverage = averageScores(operatorReviews);
    const combined = votes.length && operatorReviews.length
      ? (participantAverage.total * 0.6) + (operatorAverage.total * 0.4)
      : votes.length ? participantAverage.total : operatorAverage.total;
    payload.results = {
      participant: participantAverage,
      operator: operatorAverage,
      combined
    };
    payload.operatorReviews = operatorReviews.map((review) => ({
      ...review,
      reviewerName: review.reviewerName || db.users.find((item) => item.id === review.userId)?.name || '심사위원'
    }));
    payload.participantReviews = votes.map((vote) => {
      const participant = db.users.find((item) => item.id === vote.userId);
      const participantTeam = db.teams.find((item) => item.id === participant?.teamId);
      return {
        id: vote.id,
        participantName: participant?.name || '참가자',
        participantTeamName: participantTeam?.name || '소속팀 없음',
        scores: vote.scores,
        comment: vote.comment,
        updatedAt: vote.updatedAt
      };
    });
  }
  return payload;
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true, storage: supabase ? 'supabase' : 'local' });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    const body = await readBody(req);
    const email = cleanText(body.email, 120).toLowerCase();
    const user = db.users.find((item) => item.email.toLowerCase() === email);
    if (!user || !verifyPassword(String(body.password || ''), user.passwordHash)) {
      return error(res, 401, '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    const token = createSessionToken(user);
    return json(res, 200, { user: publicUser(user) }, {
      'Set-Cookie': sessionCookie(req, token)
    });
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    const body = await readBody(req);
    const name = cleanText(body.name, 30);
    const email = cleanText(body.email, 120).toLowerCase();
    const password = String(body.password || '');
    const teamCode = cleanText(body.teamCode, 30).toUpperCase();
    const team = db.teams.find((item) => item.code.toUpperCase() === teamCode);
    if (name.length < 2) return error(res, 400, '이름을 2자 이상 입력해 주세요.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return error(res, 400, '올바른 이메일을 입력해 주세요.');
    if (password.length < 8) return error(res, 400, '비밀번호는 8자 이상이어야 합니다.');
    if (!team) return error(res, 400, '유효하지 않은 팀 참가 코드입니다.');
    if (db.users.some((item) => item.email.toLowerCase() === email)) return error(res, 409, '이미 가입된 이메일입니다.');
    db.users.push({ id: id('user'), name, email, passwordHash: passwordHash(password), role: 'participant', teamId: team.id });
    await saveDatabase();
    return json(res, 201, { message: '가입이 완료되었습니다. 이제 로그인해 주세요.' });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
  }

  if (req.method === 'GET' && pathname === '/api/me') {
    const user = currentUser(req);
    return json(res, 200, { user: user ? publicUser(user) : null });
  }

  if (req.method === 'POST' && pathname === '/api/account/password') {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await readBody(req);
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!verifyPassword(currentPassword, user.passwordHash)) return error(res, 403, '현재 비밀번호가 올바르지 않습니다.');
    if (newPassword.length < 12) return error(res, 400, '새 비밀번호는 12자 이상이어야 합니다.');
    user.passwordHash = passwordHash(newPassword);
    await saveDatabase();
    return json(res, 200, { message: '비밀번호를 변경했습니다.' }, {
      'Set-Cookie': sessionCookie(req, createSessionToken(user))
    });
  }

  if (req.method === 'GET' && pathname === '/api/dashboard') {
    const user = requireUser(req, res);
    if (!user) return;
    const includeResults = user.role === 'operator';
    const teams = db.teams.slice().sort((a, b) => a.order - b.order).map((team) => teamPayload(team, user, includeResults));
    const activeTeam = db.event.activeTeamId ? db.teams.find((team) => team.id === db.event.activeTeamId) : null;
    const eligibleUsers = activeTeam
      ? db.users.filter((item) => item.role === 'participant' && item.teamId !== activeTeam.id)
      : [];
    const activeVoteUserIds = new Set(
      activeTeam ? db.votes.filter((vote) => vote.teamId === activeTeam.id).map((vote) => vote.userId) : []
    );
    const attendance = user.role === 'operator' ? {
      teamId: activeTeam?.id || null,
      teamName: activeTeam?.name || null,
      eligible: eligibleUsers.length,
      voted: eligibleUsers.filter((item) => activeVoteUserIds.has(item.id)).map((item) => publicUser(item)),
      notVoted: eligibleUsers.filter((item) => !activeVoteUserIds.has(item.id)).map((item) => publicUser(item))
    } : null;
    const activeTeamPayload = teams.find((team) => team.id === db.event.activeTeamId);
    return json(res, 200, {
      event: db.event,
      user: publicUser(user),
      teams,
      attendance,
      stats: {
        published: teams.filter((team) => team.published).length,
        total: teams.length,
        myVotes: user.role === 'participant' && activeTeamPayload?.myVote ? 1 : 0,
        eligible: user.role === 'participant' && activeTeamPayload && !activeTeamPayload.isOwnTeam ? 1 : 0,
        participants: db.users.filter((item) => item.role === 'participant').length
      }
    });
  }

  if (req.method === 'POST' && pathname === '/api/teams') {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const body = await readBody(req);
    const name = cleanText(body.name, 40);
    const code = cleanText(body.code, 20).toUpperCase();
    const color = /^#[0-9a-f]{6}$/i.test(String(body.color || '')) ? body.color : '#f05a2a';
    if (name.length < 2) return error(res, 400, '팀 이름을 2자 이상 입력해 주세요.');
    if (!/^[A-Z0-9-]{4,20}$/.test(code)) return error(res, 400, '참가 코드는 영문 대문자, 숫자, 하이픈으로 4~20자여야 합니다.');
    if (db.teams.some((item) => item.name.toLowerCase() === name.toLowerCase())) return error(res, 409, '이미 같은 이름의 팀이 있습니다.');
    if (db.teams.some((item) => item.code.toUpperCase() === code)) return error(res, 409, '이미 사용 중인 참가 코드입니다.');
    const team = {
      id: id('team'),
      name,
      code,
      color,
      order: Math.max(0, ...db.teams.map((item) => item.order)) + 1
    };
    db.teams.push(team);
    await saveDatabase();
    return json(res, 201, { team: teamPayload(team, user, true), message: `${name} 팀을 추가했습니다.` });
  }

  const teamDeleteMatch = pathname.match(/^\/api\/teams\/([^/]+)$/);
  if (req.method === 'DELETE' && teamDeleteMatch) {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const team = db.teams.find((item) => item.id === teamDeleteMatch[1]);
    if (!team) return error(res, 404, '팀을 찾을 수 없습니다.');
    const storedNames = removeTeams(new Set([team.id]));
    db.event.updatedAt = new Date().toISOString();
    await saveDatabase();
    await deleteStoredFiles(storedNames);
    return json(res, 200, { message: `${team.name} 팀과 관련 데이터를 삭제했습니다.` });
  }

  if (req.method === 'POST' && pathname === '/api/event/next-team') {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const publishedTeams = db.teams
      .filter((team) => db.presentations.some((presentation) => presentation.teamId === team.id))
      .sort((a, b) => a.order - b.order);
    if (!publishedTeams.length) return error(res, 400, '공개된 발표 팀이 없습니다.');
    const currentIndex = publishedTeams.findIndex((team) => team.id === db.event.activeTeamId);
    const nextTeam = currentIndex < 0 ? publishedTeams[0] : publishedTeams[currentIndex + 1];
    if (!nextTeam) return error(res, 400, '마지막 발표 팀입니다. 다음 팀이 없습니다.');
    db.event.activeTeamId = nextTeam.id;
    db.event.votingOpen = true;
    db.event.updatedAt = new Date().toISOString();
    await saveDatabase();
    return json(res, 200, { event: db.event, team: teamPayload(nextTeam, user, true), message: `${nextTeam.name} 투표를 시작했습니다.` });
  }

  if (req.method === 'PATCH' && pathname === '/api/event') {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const body = await readBody(req);
    if (!Object.hasOwn(body, 'votingOpen') && !Object.hasOwn(body, 'activeTeamId')) {
      return error(res, 400, '변경할 투표 설정이 없습니다.');
    }
    let nextActiveTeamId = db.event.activeTeamId;
    let nextVotingOpen = db.event.votingOpen;
    if (Object.hasOwn(body, 'votingOpen')) {
      if (typeof body.votingOpen !== 'boolean') return error(res, 400, '투표 상태가 올바르지 않습니다.');
      nextVotingOpen = body.votingOpen;
    }
    if (Object.hasOwn(body, 'activeTeamId')) {
      if (body.activeTeamId === null) {
        nextActiveTeamId = null;
        nextVotingOpen = false;
      } else {
        const activeTeam = db.teams.find((item) => item.id === body.activeTeamId);
        if (!activeTeam) return error(res, 404, '팀을 찾을 수 없습니다.');
        if (!db.presentations.some((item) => item.teamId === activeTeam.id)) return error(res, 400, '발표 정보를 공개한 팀만 투표 대상으로 지정할 수 있습니다.');
        nextActiveTeamId = activeTeam.id;
      }
    }
    if (nextVotingOpen && !nextActiveTeamId) return error(res, 400, '먼저 투표할 팀을 지정해 주세요.');
    db.event.activeTeamId = nextActiveTeamId;
    db.event.votingOpen = nextVotingOpen;
    db.event.updatedAt = new Date().toISOString();
    await saveDatabase();
    return json(res, 200, { event: db.event });
  }

  const presentationMatch = pathname.match(/^\/api\/teams\/([^/]+)\/presentation$/);
  if (req.method === 'POST' && presentationMatch) {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const teamId = presentationMatch[1];
    const team = db.teams.find((item) => item.id === teamId);
    if (!team) return error(res, 404, '팀을 찾을 수 없습니다.');
    const body = await readBody(req);
    const title = cleanText(body.title, 80);
    const summary = cleanText(body.summary, 500);
    const details = cleanText(body.details, 3000);
    if (title.length < 2 || summary.length < 10) return error(res, 400, '프로젝트명과 10자 이상의 소개를 입력해 주세요.');
    const now = new Date().toISOString();
    const existing = db.presentations.find((item) => item.teamId === teamId);
    if (existing) Object.assign(existing, { title, summary, details, category: cleanText(body.category, 30), updatedAt: now, publishedBy: user.id });
    else db.presentations.push({ id: id('presentation'), teamId, title, summary, details, category: cleanText(body.category, 30), createdAt: now, updatedAt: now, publishedBy: user.id });
    await saveDatabase();
    return json(res, 200, { team: teamPayload(team, user, true) });
  }

  const materialUploadMatch = pathname.match(/^\/api\/teams\/([^/]+)\/materials$/);
  if (req.method === 'POST' && materialUploadMatch) {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const teamId = materialUploadMatch[1];
    const team = db.teams.find((item) => item.id === teamId);
    if (!team) return error(res, 404, '팀을 찾을 수 없습니다.');
    if (db.materials.filter((item) => item.teamId === teamId).length >= 5) return error(res, 400, '한 팀에는 발표자료를 최대 5개까지 등록할 수 있습니다.');
    const body = await readBody(req, 15 * 1024 * 1024);
    const originalName = path.basename(cleanText(body.fileName, 150));
    const extension = path.extname(originalName).toLowerCase();
    if (!originalName || !allowedMaterialExtensions.has(extension)) return error(res, 400, 'PDF, PPT, PPTX 또는 이미지 파일만 등록할 수 있습니다.');
    const encoded = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return error(res, 400, '파일 데이터가 올바르지 않습니다.');
    const fileBuffer = Buffer.from(encoded, 'base64');
    if (!fileBuffer.length) return error(res, 400, '비어 있거나 올바르지 않은 파일입니다.');
    if (fileBuffer.length > MAX_MATERIAL_SIZE) return error(res, 400, '파일은 10MB 이하여야 합니다.');
    const materialId = id('material');
    const storedName = `${materialId}${extension}`;
    await storeFile(storedName, fileBuffer, materialMimeTypes[extension]);
    const material = {
      id: materialId,
      teamId,
      originalName,
      storedName,
      mimeType: materialMimeTypes[extension],
      size: fileBuffer.length,
      createdAt: new Date().toISOString(),
      uploadedBy: user.id
    };
    db.materials.push(material);
    await saveDatabase();
    return json(res, 201, {
      material: { id: material.id, originalName, mimeType: material.mimeType, size: material.size, createdAt: material.createdAt },
      message: '발표자료를 등록했습니다.'
    });
  }

  const materialDownloadMatch = pathname.match(/^\/api\/materials\/([^/]+)\/download$/);
  if (req.method === 'GET' && materialDownloadMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const material = db.materials.find((item) => item.id === materialDownloadMatch[1]);
    if (!material) return error(res, 404, '발표자료를 찾을 수 없습니다.');
    if (user.role === 'participant' && !db.presentations.some((item) => item.teamId === material.teamId)) {
      return error(res, 403, '아직 공개되지 않은 발표자료입니다.');
    }
    try {
      const file = await readStoredFile(material.storedName);
      res.writeHead(200, {
        'Content-Type': material.mimeType,
        'Content-Length': file.length,
        'Content-Disposition': `${new URL(req.url, 'http://localhost').searchParams.get('inline') === '1' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(material.originalName)}`,
        'Cache-Control': 'private, no-store'
      });
      return res.end(file);
    } catch (readError) {
      if (readError.code === 'ENOENT') return error(res, 404, '저장된 파일을 찾을 수 없습니다.');
      throw readError;
    }
  }

  const materialDeleteMatch = pathname.match(/^\/api\/materials\/([^/]+)$/);
  if (req.method === 'DELETE' && materialDeleteMatch) {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const index = db.materials.findIndex((item) => item.id === materialDeleteMatch[1]);
    if (index < 0) return error(res, 404, '발표자료를 찾을 수 없습니다.');
    const [material] = db.materials.splice(index, 1);
    await saveDatabase();
    await deleteStoredFiles([material.storedName]);
    return json(res, 200, { message: '발표자료를 삭제했습니다.' });
  }

  const reviewMatch = pathname.match(/^\/api\/teams\/([^/]+)\/review$/);
  if (req.method === 'POST' && reviewMatch) {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const teamId = reviewMatch[1];
    if (!db.teams.some((item) => item.id === teamId)) return error(res, 404, '팀을 찾을 수 없습니다.');
    if (!db.presentations.some((item) => item.teamId === teamId)) return error(res, 400, '먼저 발표 정보를 공개해 주세요.');
    const body = await readBody(req);
    const scores = validateScores(body.scores || {});
    if (!scores) return error(res, 400, '모든 평가 항목에 1~5점을 입력해 주세요.');
    const reviewerName = cleanText(body.reviewerName, 40);
    if (reviewerName.length < 2) return error(res, 400, '심사위원 이름을 2자 이상 입력해 주세요.');
    const comment = cleanText(body.comment, 500);
    if (comment.length < 3) return error(res, 400, '가장 강한 점과 보완할 점을 포함한 한 줄 평가를 입력해 주세요.');
    const now = new Date().toISOString();
    const reviewId = cleanText(body.reviewId, 80);
    const existing = reviewId ? db.operatorReviews.find((item) => item.id === reviewId && item.teamId === teamId) : null;
    if (reviewId && !existing) return error(res, 404, '수정할 심사 평가를 찾을 수 없습니다.');
    if (existing) Object.assign(existing, { reviewerName, scores, comment, updatedAt: now });
    else db.operatorReviews.push({ id: id('review'), teamId, userId: user.id, createdBy: user.id, reviewerName, scores, comment, createdAt: now, updatedAt: now });
    await saveDatabase();
    return json(res, 200, { message: `${reviewerName} 심사위원의 평가가 저장되었습니다.` });
  }

  const reviewDeleteMatch = pathname.match(/^\/api\/reviews\/([^/]+)$/);
  if (req.method === 'DELETE' && reviewDeleteMatch) {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const index = db.operatorReviews.findIndex((item) => item.id === reviewDeleteMatch[1]);
    if (index < 0) return error(res, 404, '심사 평가를 찾을 수 없습니다.');
    const [review] = db.operatorReviews.splice(index, 1);
    await saveDatabase();
    return json(res, 200, { message: `${review.reviewerName || '심사위원'} 평가를 삭제했습니다.` });
  }

  const teamVoteResetMatch = pathname.match(/^\/api\/teams\/([^/]+)\/votes$/);
  if (req.method === 'DELETE' && teamVoteResetMatch) {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const team = db.teams.find((item) => item.id === teamVoteResetMatch[1]);
    if (!team) return error(res, 404, '팀을 찾을 수 없습니다.');
    const previousCount = db.votes.length;
    db.votes = db.votes.filter((vote) => vote.teamId !== team.id);
    const removedCount = previousCount - db.votes.length;
    await saveDatabase();
    return json(res, 200, { removedCount, message: `${team.name}의 참가자 투표 ${removedCount}건을 초기화했습니다.` });
  }

  if (req.method === 'DELETE' && pathname === '/api/votes') {
    const user = requireUser(req, res, 'operator');
    if (!user) return;
    const removedCount = db.votes.length;
    db.votes = [];
    await saveDatabase();
    return json(res, 200, { removedCount, message: `전체 참가자 투표 ${removedCount}건을 초기화했습니다.` });
  }

  const voteMatch = pathname.match(/^\/api\/teams\/([^/]+)\/vote$/);
  if (req.method === 'POST' && voteMatch) {
    const user = requireUser(req, res, 'participant');
    if (!user) return;
    const teamId = voteMatch[1];
    if (!db.event.votingOpen) return error(res, 403, '현재 투표가 마감되었습니다.');
    if (!db.event.activeTeamId) return error(res, 403, '현재 지정된 투표 팀이 없습니다.');
    if (db.event.activeTeamId !== teamId) return error(res, 403, '현재 투표 대상으로 지정된 팀만 평가할 수 있습니다.');
    if (user.teamId === teamId) return error(res, 403, '소속 팀에는 투표할 수 없습니다.');
    if (!db.presentations.some((item) => item.teamId === teamId)) return error(res, 400, '아직 공개되지 않은 발표입니다.');
    const body = await readBody(req);
    const scores = validateScores(body.scores || {});
    if (!scores) return error(res, 400, '모든 평가 항목에 1~5점을 입력해 주세요.');
    const comment = cleanText(body.comment, 300);
    if (comment.length < 3) return error(res, 400, '가장 강한 점과 보완할 점을 포함한 한 줄 평가를 입력해 주세요.');
    const now = new Date().toISOString();
    const existing = db.votes.find((item) => item.teamId === teamId && item.userId === user.id);
    if (existing) Object.assign(existing, { scores, comment, updatedAt: now });
    else db.votes.push({ id: id('vote'), teamId, userId: user.id, scores, comment, createdAt: now, updatedAt: now });
    await saveDatabase();
    return json(res, 200, { message: existing ? '투표를 수정했습니다.' : '투표가 제출되었습니다.' });
  }

  return error(res, 404, 'API를 찾을 수 없습니다.');
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

async function serveStatic(res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const resolved = path.resolve(PUBLIC_DIR, requested);
  if (!resolved.startsWith(`${PUBLIC_DIR}${path.sep}`) && resolved !== path.join(PUBLIC_DIR, 'index.html')) return error(res, 403, '접근할 수 없습니다.');
  try {
    const data = await fs.readFile(resolved);
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(resolved)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') return serveStatic(res, '/');
    throw err;
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      // Vercel의 여러 실행 인스턴스가 오래된 메모리 상태로 최신 평가를
      // 덮어쓰지 않도록 API 요청마다 Supabase의 최신 상태를 읽는다.
      if (url.pathname.startsWith('/api/')) {
        const processRequest = async () => {
          if (supabase && url.pathname !== '/api/health') {
            const stored = await readStoredDatabase();
            db = stored.database;
          }
          await handleApi(req, res, url.pathname);
        };
        const queuedRequest = apiRequestQueue.catch(() => {}).then(processRequest);
        apiRequestQueue = queuedRequest;
        await queuedRequest;
      }
      else await serveStatic(res, url.pathname);
    } catch (err) {
      console.error(err);
      error(res, err.message.includes('JSON') || err.message.includes('너무 큽니다') ? 400 : 500, err.message || '서버 오류가 발생했습니다.');
    }
  });
}

async function start() {
  await loadDatabase();
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`Hackathon Stage: http://localhost:${PORT}`);
    if (generatedAdminPassword) {
      console.log(`Initial admin: admin@hackathon.kr / ${generatedAdminPassword}`);
    }
  });
  return server;
}

if (require.main === module || process.env.VERCEL === '1') start();

// Vercel의 Node server 엔트리포인트는 사용자 정의 export를 허용하지 않는다.
// 로컬 테스트에서 불러올 때만 검증 함수를 노출한다.
if (!process.env.VERCEL) {
  module.exports = { createServer, loadDatabase, passwordHash, verifyPassword };
}
