const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ExcelJS = require('exceljs');

let child;
let baseUrl;
let tempDir;

const validScores = {
  problemValue: 5,
  goalSpecificity: 4,
  solutionFit: 4,
  solutionOriginality: 5,
  aiRelevance: 4,
  feasibility: 4,
  structuralCompleteness: 5,
  impactScalability: 5,
  pitchQuality: 4,
  attitudeDefense: 5
};

async function request(pathname, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  return { response, body, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}

async function login(email, password) {
  const result = await request('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  assert.equal(result.response.status, 200);
  return result.cookie;
}

test.before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hackathon-vote-test-'));
  const port = 31000 + Math.floor(Math.random() * 1000);
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: path.join(tempDir, 'database.json'),
      UPLOAD_DIR: path.join(tempDir, 'uploads'),
      ADMIN_PASSWORD: 'admin1234',
      SEED_DEMO_DATA: 'true',
      SUPABASE_DISABLED: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('서버 시작 시간 초과')), 10000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Hackathon Stage')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`서버가 종료되었습니다: ${code}`)));
  });
});

test.after(async () => {
  child?.kill('SIGTERM');
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('발표 공개 → 익명 참가자 투표 → 마감 흐름', async () => {
  const operatorCookie = await login('admin@hackathon.kr', 'admin1234');

  let result = await request('/api/teams/team_pixel/presentation', {
    method: 'POST',
    body: JSON.stringify({ title: '픽셀 가이드', category: 'AI', summary: '시각장애인을 위한 실시간 공간 안내 서비스입니다.' })
  }, operatorCookie);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.team.published, true);

  result = await request('/api/teams/team_green/presentation', {
    method: 'POST',
    body: JSON.stringify({ title: '그린 루프', category: 'SOCIAL', summary: '지역의 다회용기를 연결하는 순환 서비스입니다.' })
  }, operatorCookie);
  assert.equal(result.response.status, 200);

  result = await request('/api/event', {
    method: 'PATCH',
    body: JSON.stringify({ activeTeamId: 'team_pixel', votingOpen: true })
  }, operatorCookie);
  assert.equal(result.response.status, 200);

  result = await request('/api/dashboard', {}, operatorCookie);
  assert.equal(result.body.attendance.teamId, 'team_pixel');
  assert.equal(result.body.attendance.eligible, 3);
  assert.equal(result.body.attendance.notVoted.length, 3);

  const participantCookie = await login('nova@hackathon.kr', 'vote1234');
  result = await request('/api/teams/team_nova/vote', {
    method: 'POST',
    body: JSON.stringify({ scores: validScores })
  }, participantCookie);
  assert.equal(result.response.status, 403);

  result = await request('/api/teams/team_green/vote', {
    method: 'POST',
    body: JSON.stringify({ scores: validScores })
  }, participantCookie);
  assert.equal(result.response.status, 403);

  result = await request('/api/teams/team_pixel/vote', {
    method: 'POST',
    body: JSON.stringify({ scores: validScores, comment: '응원합니다.' })
  }, participantCookie);
  assert.equal(result.response.status, 200);

  result = await request('/api/dashboard', {}, participantCookie);
  assert.equal(result.body.stats.myVotes, 1);
  assert.equal(result.body.teams.find((team) => team.id === 'team_pixel').myVote.scores.impactScalability, 5);

  result = await request('/api/dashboard', {}, operatorCookie);
  assert.equal(result.body.attendance.voted.length, 1);
  assert.equal(result.body.attendance.voted[0].name, '이노바');
  assert.equal(result.body.attendance.notVoted.length, 2);
  const pixelTeam = result.body.teams.find((team) => team.id === 'team_pixel');
  assert.equal(pixelTeam.participantReviews.length, 1);
  assert.match(pixelTeam.participantReviews[0].anonymousLabel, /^익명 [A-F0-9]{6}$/);
  assert.deepEqual(Object.keys(pixelTeam.participantReviews[0]).sort(), ['anonymousLabel', 'comment', 'scores']);
  assert.equal(Object.hasOwn(pixelTeam.participantReviews[0], 'participantName'), false);
  assert.equal(Object.hasOwn(pixelTeam.participantReviews[0], 'participantTeamName'), false);
  assert.equal(pixelTeam.participantReviews[0].comment, '응원합니다.');

  const excelResponse = await fetch(`${baseUrl}/api/results/export`, { headers: { Cookie: operatorCookie } });
  assert.equal(excelResponse.status, 200);
  assert.match(excelResponse.headers.get('content-type'), /spreadsheetml/);
  assert.match(excelResponse.headers.get('content-disposition'), /hackathon-results-.*\.xlsx/);
  const excelBuffer = Buffer.from(await excelResponse.arrayBuffer());
  assert.equal(excelBuffer.subarray(0, 2).toString(), 'PK');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['종합 결과', '익명 참가자 평가']);
  const participantSheetValues = JSON.stringify(workbook.getWorksheet('익명 참가자 평가').getSheetValues());
  assert.match(participantSheetValues, /익명 [A-F0-9]{6}/);
  assert.doesNotMatch(participantSheetValues, /이노바|nova@hackathon\.kr|Team Nova/);
  const unauthorizedExcel = await fetch(`${baseUrl}/api/results/export`, { headers: { Cookie: participantCookie } });
  assert.equal(unauthorizedExcel.status, 403);

  result = await request('/api/event', { method: 'PATCH', body: JSON.stringify({ votingOpen: false }) }, operatorCookie);
  assert.equal(result.response.status, 200);

  result = await request('/api/teams/team_pixel/vote', {
    method: 'POST',
    body: JSON.stringify({ scores: validScores })
  }, participantCookie);
  assert.equal(result.response.status, 403);

  result = await request('/api/event/next-team', { method: 'POST' }, operatorCookie);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.event.activeTeamId, 'team_green');
  assert.equal(result.body.event.votingOpen, true);

  result = await request('/api/event/next-team', { method: 'POST' }, operatorCookie);
  assert.equal(result.response.status, 400);
});

test('팀 코드 가입과 중복 이메일 방지', async () => {
  const payload = { name: '새참가자', email: 'new@example.com', password: 'password123', teamCode: 'GREEN26' };
  let result = await request('/api/register', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(result.response.status, 201);
  result = await request('/api/register', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(result.response.status, 409);
  await login(payload.email, payload.password);
});

test('운영자 팀 추가와 발표자료 업로드·다운로드', async () => {
  const operatorCookie = await login('admin@hackathon.kr', 'admin1234');
  let result = await request('/api/teams', {
    method: 'POST',
    body: JSON.stringify({ name: 'Rocket Lab', code: 'ROCKET26', color: '#e54f80' })
  }, operatorCookie);
  assert.equal(result.response.status, 201);
  const teamId = result.body.team.id;
  assert.equal(result.body.team.code, 'ROCKET26');

  result = await request('/api/dashboard', {}, operatorCookie);
  assert.equal(result.body.teams.find((team) => team.id === teamId).code, 'ROCKET26');

  result = await request('/api/teams', {
    method: 'POST',
    body: JSON.stringify({ name: 'Another Team', code: 'ROCKET26', color: '#000000' })
  }, operatorCookie);
  assert.equal(result.response.status, 409);

  const fileContent = '%PDF-1.4\nDemo presentation';
  result = await request(`/api/teams/${teamId}/materials`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: 'rocket-demo.pdf',
      mimeType: 'application/pdf',
      data: `data:application/pdf;base64,${Buffer.from(fileContent).toString('base64')}`
    })
  }, operatorCookie);
  assert.equal(result.response.status, 201);
  const materialId = result.body.material.id;

  let download = await fetch(`${baseUrl}/api/materials/${materialId}/download`, { headers: { Cookie: operatorCookie } });
  assert.equal(download.status, 200);
  assert.equal(await download.text(), fileContent);
  assert.match(download.headers.get('content-disposition'), /rocket-demo\.pdf/);

  const participantCookie = await login('nova@hackathon.kr', 'vote1234');
  result = await request('/api/dashboard', {}, participantCookie);
  assert.equal(Object.hasOwn(result.body.teams.find((team) => team.id === teamId), 'code'), false);
  download = await fetch(`${baseUrl}/api/materials/${materialId}/download`, { headers: { Cookie: participantCookie } });
  assert.equal(download.status, 403);

  result = await request(`/api/teams/${teamId}/presentation`, {
    method: 'POST',
    body: JSON.stringify({
      title: '로켓 데모',
      category: 'ETC',
      summary: '더 빠른 발표 준비를 돕는 협업 프로젝트입니다.',
      details: '발표자의 리허설을 분석하고 핵심 개선점을 제안합니다.'
    })
  }, operatorCookie);
  assert.equal(result.response.status, 200);
  result = await request('/api/dashboard', {}, participantCookie);
  const publishedTeam = result.body.teams.find((team) => team.id === teamId);
  assert.equal(publishedTeam.presentation.details, '발표자의 리허설을 분석하고 핵심 개선점을 제안합니다.');
  assert.equal(publishedTeam.materials[0].originalName, 'rocket-demo.pdf');
  download = await fetch(`${baseUrl}/api/materials/${materialId}/download`, { headers: { Cookie: participantCookie } });
  assert.equal(download.status, 200);
  const inline = await fetch(`${baseUrl}/api/materials/${materialId}/download?inline=1`, { headers: { Cookie: participantCookie } });
  assert.equal(inline.status, 200);
  assert.match(inline.headers.get('content-disposition'), /^inline;/);

  result = await request(`/api/teams/${teamId}/presentation/unpublish`, { method: 'POST' }, operatorCookie);
  assert.equal(result.response.status, 200);
  result = await request('/api/dashboard', {}, participantCookie);
  const unpublishedTeam = result.body.teams.find((team) => team.id === teamId);
  assert.equal(unpublishedTeam.published, false);
  assert.equal(unpublishedTeam.presentation, null);
  assert.equal(unpublishedTeam.materials.length, 0);
  download = await fetch(`${baseUrl}/api/materials/${materialId}/download`, { headers: { Cookie: participantCookie } });
  assert.equal(download.status, 403);
  result = await request('/api/dashboard', {}, operatorCookie);
  const operatorUnpublishedTeam = result.body.teams.find((team) => team.id === teamId);
  assert.equal(operatorUnpublishedTeam.presentation, null);
  assert.equal(operatorUnpublishedTeam.materials[0].originalName, 'rocket-demo.pdf');

  result = await request(`/api/teams/${teamId}`, { method: 'DELETE' }, operatorCookie);
  assert.equal(result.response.status, 200);
  download = await fetch(`${baseUrl}/api/materials/${materialId}/download`, { headers: { Cookie: operatorCookie } });
  assert.equal(download.status, 404);
  result = await request('/api/dashboard', {}, operatorCookie);
  assert.equal(result.body.teams.some((team) => team.id === teamId), false);
});

test('평가 전용 그룹은 발표에서 제외되고 모든 발표를 평가할 수 있다', async () => {
  const operatorCookie = await login('admin@hackathon.kr', 'admin1234');
  let result = await request('/api/teams', {
    method: 'POST',
    body: JSON.stringify({ name: 'Teacher Judges', code: 'TEACHER26', color: '#7657ff', evaluatorOnly: true })
  }, operatorCookie);
  assert.equal(result.response.status, 201);
  const evaluatorTeamId = result.body.team.id;
  assert.equal(result.body.team.evaluatorOnly, true);

  result = await request(`/api/teams/${evaluatorTeamId}/presentation`, {
    method: 'POST',
    body: JSON.stringify({ title: '발표하면 안 됨', category: 'ETC', summary: '평가 전용 그룹은 발표할 수 없습니다.' })
  }, operatorCookie);
  assert.equal(result.response.status, 400);

  result = await request('/api/register', {
    method: 'POST',
    body: JSON.stringify({ name: '평가선생님', email: 'teacher@example.com', password: 'password123', teamCode: 'TEACHER26' })
  });
  assert.equal(result.response.status, 201);
  const teacherCookie = await login('teacher@example.com', 'password123');
  result = await request('/api/dashboard', {}, teacherCookie);
  assert.equal(result.body.teams.some((team) => team.id === evaluatorTeamId), false);
  assert.equal(result.body.teams.find((team) => team.id === 'team_green').eligible, true);

  result = await request('/api/dashboard', {}, operatorCookie);
  assert.equal(result.body.stats.evaluatorTeams, 1);
  assert.equal(result.body.stats.total, 4);
  assert.equal(result.body.teams.find((team) => team.id === evaluatorTeamId).memberCount, 1);

  const excelResponse = await fetch(`${baseUrl}/api/results/export`, { headers: { Cookie: operatorCookie } });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await excelResponse.arrayBuffer()));
  const summaryValues = JSON.stringify(workbook.getWorksheet('종합 결과').getSheetValues());
  assert.doesNotMatch(summaryValues, /Teacher Judges/);
});

test('팀별·전체 참가자 투표 초기화와 권한 검사', async () => {
  const operatorCookie = await login('admin@hackathon.kr', 'admin1234');
  const participantCookie = await login('nova@hackathon.kr', 'vote1234');

  let result = await request('/api/teams/team_pixel/votes', { method: 'DELETE' }, participantCookie);
  assert.equal(result.response.status, 403);

  result = await request('/api/teams/team_pixel/votes', { method: 'DELETE' }, operatorCookie);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.removedVoteCount, 1);
  assert.equal(result.body.removedReviewCount, 0);
  assert.equal(result.body.removedCount, 1);

  result = await request('/api/dashboard', {}, operatorCookie);
  assert.equal(result.body.teams.find((team) => team.id === 'team_pixel').participantVoteCount, 0);

  result = await request('/api/teams/team_green/vote', {
    method: 'POST',
    body: JSON.stringify({ scores: validScores, comment: '확장성이 좋고 사용자 검증을 더 보완하면 좋겠습니다.' })
  }, participantCookie);
  assert.equal(result.response.status, 200);

  result = await request('/api/votes', { method: 'DELETE' }, operatorCookie);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.removedVoteCount, 1);
  assert.equal(result.body.removedReviewCount, 0);
  assert.equal(result.body.removedCount, 1);

  result = await request('/api/dashboard', {}, operatorCookie);
  assert.equal(result.body.teams.reduce((sum, team) => sum + team.participantVoteCount, 0), 0);
});

test('관리자 비밀번호 변경', async () => {
  const operatorCookie = await login('admin@hackathon.kr', 'admin1234');
  let result = await request('/api/account/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'admin1234', newPassword: 'New-Secure-Password-2026!' })
  }, operatorCookie);
  assert.equal(result.response.status, 200);
  result = await request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@hackathon.kr', password: 'admin1234' })
  });
  assert.equal(result.response.status, 401);
  await login('admin@hackathon.kr', 'New-Secure-Password-2026!');
});
