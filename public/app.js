const app = document.querySelector('#app');
const toastRoot = document.querySelector('#toast-root');
const SESSION_KEY = 'hackathon-stage-session';

const state = {
  user: null,
  dashboard: null,
  managedUsers: [],
  authMode: 'login',
  modal: null,
  refreshTimer: null
};

const scoreMeta = [
  ['problemValue', 'Q1. 문제 발견의 적절성 및 공익성', '누가 이 문제로 고통받는지, 명확한 공익적 가치가 보이는가?', '1단계 · 문제 정의'],
  ['goalSpecificity', 'Q2. 목표의 구체성', '타겟의 페인포인트와 최종 목표가 구체적인 상황이나 지표로 정의됐는가?', '1단계 · 문제 정의'],
  ['solutionFit', 'Q3. 문제 해결 과정의 적합성', '논리적 비약 없이 비용과 시간 대비 효율적인 해결책인가?', '2단계 · 솔루션 및 기술'],
  ['solutionOriginality', 'Q4. 문제 해결 과정의 참신성', '기존 솔루션과 비교해 확실한 우위나 독창적인 접근이 있는가?', '2단계 · 솔루션 및 기술'],
  ['aiRelevance', 'Q5. AI 기술 활용의 적절성', 'AI가 핵심 병목을 해결하며 일반 소프트웨어보다 명확한 이점을 주는가?', '2단계 · 솔루션 및 기술'],
  ['feasibility', 'Q6. 현실적 실현 가능성', '현존 기술과 시장 환경에서 실제 상용화가 가능하며 근거가 있는가?', '2단계 · 솔루션 및 기술'],
  ['structuralCompleteness', 'Q7. 문제 해결 과정의 구조적 완성도', '문제·원인·솔루션·기대효과의 흐름이 빈틈없이 연결되는가?', '3단계 · 논리 구조 및 전달력'],
  ['impactScalability', 'Q8. 아이디어의 파급력 및 확장성', '긍정적 영향이 납득 가능하고 지속 가능한 성장 가능성이 있는가?', '3단계 · 논리 구조 및 전달력'],
  ['pitchQuality', 'Q9. 발표 완성도', '자료의 시각적 완성도와 제한 시간 내 전달력이 충분한가?', '3단계 · 논리 구조 및 전달력'],
  ['attitudeDefense', 'Q10. 태도 및 디펜스 능력', '질문과 비판을 유연하고 논리적으로 수용하며 답변하는가?', '4단계 · 창업가적 태도']
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function icon(name) {
  const icons = {
    arrow: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 4 4L19 6"/></svg>',
    lock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    chart: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    settings: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
    copy: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg>'
  };
  return icons[name] || '';
}

async function api(url, options = {}) {
  const token = window.sessionStorage.getItem(SESSION_KEY);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
  return data;
}

function toast(message, type = 'success') {
  const element = document.createElement('div');
  element.className = `toast ${type}`;
  element.textContent = message;
  toastRoot.appendChild(element);
  setTimeout(() => element.remove(), 3200);
}

function setButtonLoading(button, loading, label = '처리 중') {
  if (!button) return;
  if (loading) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span>${label}`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.original || button.innerHTML;
  }
}

function brand(dark = false) {
  return `<div class="brand" ${dark ? '' : 'style="color:#141511"'}><span class="brand-mark">S</span>STAGE</div>`;
}

function renderAuth() {
  const registering = state.authMode === 'register';
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-visual">
        ${brand(true)}
        <div class="visual-copy">
          <div class="eyebrow">Ideas on stage · voices in motion</div>
          <h1>Build.<br>Pitch. <em>Vote.</em></h1>
          <p>모두의 시선이 아이디어에 닿는 순간. 발표 공개부터 공정한 동료 평가, 실시간 결과까지 한곳에서 운영하세요.</p>
        </div>
        <div class="floating-score"><div><strong>4.8</strong><small>live score</small></div></div>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          <div class="mobile-brand">${brand()}</div>
          <h2>${registering ? '함께 평가해요.' : '다시 만나 반가워요.'}</h2>
          <p>${registering ? '운영자에게 받은 팀 참가 코드로 계정을 만드세요.' : '계정에 로그인하고 오늘의 빛나는 아이디어를 만나보세요.'}</p>
          <div class="auth-tabs" role="tablist">
            <button class="auth-tab ${!registering ? 'active' : ''}" data-action="auth-tab" data-mode="login">로그인</button>
            <button class="auth-tab ${registering ? 'active' : ''}" data-action="auth-tab" data-mode="register">참가자 가입</button>
          </div>
          ${registering ? registerForm() : loginForm()}
        </div>
      </section>
    </main>`;
}

function loginForm() {
  return `
    <form id="login-form">
      <div class="field"><label for="login-email">이메일</label><input id="login-email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required></div>
      <div class="field"><label for="login-password">비밀번호</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="8자 이상 입력" required></div>
      <div class="form-error" id="form-error"></div>
      <button class="primary-btn wide" type="submit">로그인 ${icon('arrow')}</button>
    </form>`;
}

function registerForm() {
  return `
    <form id="register-form">
      <div class="field"><label for="register-name">이름</label><input id="register-name" name="name" maxlength="30" autocomplete="name" placeholder="홍길동" required></div>
      <div class="field"><label for="register-email">이메일</label><input id="register-email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required></div>
      <div class="field"><label for="register-password">비밀번호</label><input id="register-password" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="8자 이상 입력" required></div>
      <div class="field"><label for="team-code">팀 참가 코드</label><input id="team-code" name="teamCode" autocomplete="off" placeholder="예: NOVA26" required><span class="field-hint">팀 운영자에게 전달받은 코드를 입력하세요.</span></div>
      <div class="form-error" id="form-error"></div>
      <button class="primary-btn wide" type="submit">계정 만들기 ${icon('arrow')}</button>
    </form>`;
}

async function loadDashboard() {
  state.dashboard = await api('/api/dashboard');
  state.user = state.dashboard.user;
  renderDashboard();
  startAutoRefresh();
}

function startAutoRefresh() {
  if (state.refreshTimer) return;
  state.refreshTimer = window.setInterval(refreshDashboard, 5000);
}

function stopAutoRefresh() {
  window.clearInterval(state.refreshTimer);
  state.refreshTimer = null;
}

async function refreshDashboard() {
  if (!state.user || document.hidden || document.querySelector('.modal-backdrop')) return;
  try {
    const dashboard = await api('/api/dashboard');
    if (JSON.stringify(dashboard) === JSON.stringify(state.dashboard)) return;
    state.dashboard = dashboard;
    state.user = dashboard.user;
    renderDashboard();
  } catch (error) {
    if (error.message === '로그인이 필요합니다.') {
      stopAutoRefresh();
      state.user = null;
      state.dashboard = null;
      renderAuth();
    }
  }
}

function renderDashboard() {
  const { event, user } = state.dashboard;
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-nav">${brand()}<span class="event-label">${escapeHtml(event.subtitle)}</span></div>
        <div class="user-menu">
          <div class="user-copy"><strong>${escapeHtml(user.name)}</strong><span>${user.role === 'operator' ? '운영자' : escapeHtml(user.teamName)}</span></div>
          <div class="avatar">${escapeHtml(user.name.slice(0, 1))}</div>
          <button class="ghost-btn account" data-action="account" aria-label="계정 설정">${icon('settings')}<span>계정 설정</span></button>
          <button class="ghost-btn logout" data-action="logout">로그아웃</button>
        </div>
      </header>
      ${user.role === 'operator' ? operatorDashboard() : participantDashboard()}
    </div>
    <div id="modal-root"></div>`;
}

function pageHeading(kicker, title, word) {
  const event = state.dashboard.event;
  const activeTeam = state.dashboard.teams.find((team) => team.id === event.activeTeamId);
  return `<div class="dashboard-head">
    <div><div class="eyebrow">${escapeHtml(kicker)}</div><h1>${escapeHtml(title)} <span>${escapeHtml(word)}</span></h1></div>
    <div class="status-chip"><span class="status-dot ${event.votingOpen ? 'live' : ''}"></span>${event.votingOpen ? `${escapeHtml(activeTeam?.name || '')} 투표 중` : activeTeam ? `${escapeHtml(activeTeam.name)} 투표 마감` : '투표 대기 중'}</div>
  </div>`;
}

function participantDashboard() {
  const { teams, stats, user, event } = state.dashboard;
  const activeTeam = teams.find((team) => team.id === event.activeTeamId);
  const ratio = stats.eligible ? Math.round((stats.myVotes / stats.eligible) * 100) : 0;
  const progressTitle = !activeTeam
    ? '운영자가 다음 발표 팀을 지정할 때까지 기다려 주세요.'
    : activeTeam.isOwnTeam
      ? `${activeTeam.name} 발표 차례입니다. 발표에 집중해 주세요!`
      : event.votingOpen
        ? `${activeTeam.name}의 발표 평가를 진행해 주세요.`
        : `${activeTeam.name} 투표가 현재 마감되어 있습니다.`;
  return `<main class="page">
    ${pageHeading(`${event.title} / participant`, `안녕하세요, ${user.name}님`, '✦')}
    <section class="progress-panel">
      <div class="progress-copy">
        <div class="eyebrow">Current presentation</div>
        <p>${escapeHtml(progressTitle)}</p>
        <div class="progress-count"><strong>${stats.myVotes}</strong><span>/ ${stats.eligible} 현재 평가 완료</span></div>
        <div class="progress-track"><span style="width:${ratio}%"></span></div>
      </div>
      <div class="progress-note">
        <div class="eyebrow">One team at a time</div>
        <strong>${activeTeam ? `지금은 ${escapeHtml(activeTeam.name)} 평가 시간이에요.` : '다음 팀이 지정되면 알려드릴게요.'}</strong>
      </div>
    </section>
    <div class="section-title"><div><h2>발표 팀</h2><p>모든 공개 발표의 내용과 자료를 볼 수 있으며, 운영자가 지정한 팀만 평가할 수 있습니다.</p></div><p>총점은 10개 항목의 평균입니다.</p></div>
    <section class="team-grid">${teams.map(participantTeamCard).join('')}</section>
  </main>`;
}

function participantTeamCard(team) {
  const event = state.dashboard.event;
  let stateLabel = !team.published ? '공개 전' : team.isActive ? (event.votingOpen ? '지금 투표' : '투표 마감') : '발표 대기';
  if (team.isActive && team.isOwnTeam) stateLabel = '내 팀 발표';
  if (team.isActive && team.myVote) stateLabel = '평가 완료';
  const stateClass = team.isOwnTeam && team.isActive ? 'own' : team.isActive || team.myVote ? 'done' : '';
  const locked = !team.eligible;
  let lockedMessage = !team.published
    ? '아직 발표가 공개되지 않았습니다.'
    : !team.isActive
      ? '운영자가 이 팀을 지정하면 투표할 수 있습니다.'
      : team.isOwnTeam
        ? '공정성을 위해 소속 팀은 평가할 수 없습니다.'
        : '현재 투표가 마감되었습니다.';
  return `<article class="team-card ${locked ? 'locked' : ''} ${team.isActive ? 'active-team' : ''}" style="--team-color:${team.color}">
    <div class="team-meta"><span class="team-number">TEAM / ${String(team.order).padStart(2, '0')}</span><span class="mini-state ${stateClass}">${stateLabel}</span></div>
    <h3>${escapeHtml(team.name)}</h3>
    ${team.presentation ? `<div class="project-name">${escapeHtml(team.presentation.title)}</div><p>${escapeHtml(team.presentation.summary)}</p>` : `<p>${team.isOwnTeam ? '내 팀의 프로젝트명과 소개를 등록해 발표를 준비하세요.' : '해당 팀이나 운영자가 발표 정보를 공개하면 프로젝트 소개가 표시됩니다.'}</p>`}
    ${team.published ? `<div class="team-actions participant-detail-action"><button class="secondary-btn" data-action="detail" data-id="${team.id}">발표 내용 · 자료 보기 ${icon('arrow')}</button></div>` : ''}
    ${team.isOwnTeam ? `<div class="team-actions own-team-actions"><button class="primary-btn" data-action="publish" data-id="${team.id}">${team.published ? '내 팀 발표 수정' : '내 팀 발표 등록'}</button><button class="secondary-btn" data-action="materials" data-id="${team.id}">자료 관리</button></div>` : ''}
    ${locked
      ? `<div class="locked-message"><span class="lock-icon">${icon('lock')}</span>${lockedMessage}</div>`
      : `<div class="team-actions"><button class="${team.myVote ? 'secondary-btn' : 'primary-btn'}" data-action="vote" data-id="${team.id}">${team.myVote ? `${icon('edit')} 평가 수정` : `평가하기 ${icon('arrow')}`}</button></div>`}
  </article>`;
}

function operatorDashboard() {
  const { teams, stats, event, attendance } = state.dashboard;
  const ranked = teams.filter((team) => team.published).slice().sort((a, b) => b.results.combined - a.results.combined);
  const publishedInOrder = teams.filter((team) => team.published).slice().sort((a, b) => a.order - b.order);
  const currentPublishedIndex = publishedInOrder.findIndex((team) => team.id === event.activeTeamId);
  const hasNextTeam = currentPublishedIndex < 0 ? publishedInOrder.length > 0 : currentPublishedIndex < publishedInOrder.length - 1;
  const totalVotes = teams.reduce((sum, team) => sum + team.participantVoteCount, 0);
  return `<main class="page">
    ${pageHeading(`${event.title} / control room`, '운영 대시보드', '●')}
    <section class="operator-strip">
      <div class="metric"><small>발표 준비</small><strong>${stats.published}<em> / ${stats.total} 팀</em></strong></div>
      <div class="metric"><small>누적 평가</small><strong>${totalVotes}<em> 건</em></strong></div>
      <div class="metric"><small>전체 참여자</small><strong>${stats.participants}<em> 명</em></strong></div>
      <div class="metric"><small>평가단 인원</small><strong>${stats.evaluatorParticipants}<em> 명</em></strong></div>
    </section>
    ${operatorAttendance(attendance)}
    <div class="section-title admin-section-title">
      <div><h2>발표 운영</h2><p>발표 정보를 공개한 뒤 한 팀을 투표 대상으로 지정하세요.</p></div>
    </div>
    <section class="admin-control-panel">
      <div class="admin-control-group">
        <div class="admin-control-copy"><small>MANAGEMENT</small><strong>팀 · 이용자 관리</strong><span>참여 그룹과 계정을 설정합니다.</span></div>
        <div class="admin-control-actions"><button class="primary-btn" data-action="add-team">+ 팀 추가</button><button class="secondary-btn" data-action="manage-users">이용자 관리</button></div>
      </div>
      <div class="admin-control-group featured">
        <div class="admin-control-copy"><small>LIVE CONTROL</small><strong>발표 진행</strong><span>다음 팀으로 이동하거나 투표를 여닫습니다.</span></div>
        <button class="primary-btn accent control-wide" data-action="next-team" ${hasNextTeam ? '' : 'disabled'}>다음 팀 투표 ${icon('arrow')}</button>
        <div class="voting-toggle-control"><div><small>현재 투표</small><strong>${event.votingOpen ? '진행 중' : '마감'}</strong></div><button class="switch ${event.votingOpen ? 'on' : ''}" data-action="toggle-voting" aria-label="투표 상태 변경" ${event.activeTeamId ? '' : 'disabled'}><span></span></button></div>
      </div>
      <div class="admin-control-group">
        <div class="admin-control-copy"><small>DATA</small><strong>결과 · 초기화</strong><span>결과를 보관하거나 평가 기록을 정리합니다.</span></div>
        <div class="admin-control-actions vertical"><button class="secondary-btn" data-action="export-results">결과 Excel ↓</button><button class="danger-outline-btn" data-action="reset-all-votes" ${totalVotes ? '' : 'disabled'}>전체 평가 초기화</button></div>
      </div>
    </section>
    <section class="team-grid">${teams.map(operatorTeamCard).join('')}</section>
    <div class="section-title" style="margin-top:48px"><div><h2>실시간 순위</h2><p>익명 참가자 평가 평균 기준입니다.</p></div><p>5점 만점</p></div>
    ${ranked.length ? `<section class="ranking">${ranked.map((team, index) => rankRow(team, index)).join('')}</section>` : '<div class="empty-state"><strong>아직 공개된 발표가 없습니다.</strong>발표 정보를 공개하면 집계 결과가 여기에 표시됩니다.</div>'}
  </main>`;
}

function operatorAttendance(attendance) {
  if (!attendance?.teamId) {
    return `<section class="attendance-panel empty-attendance">
      <div><div class="eyebrow">Live attendance</div><h2>현재 지정된 투표 팀이 없습니다.</h2><p>아래 발표 카드에서 ‘이 팀 투표 시작’을 눌러 주세요.</p></div>
    </section>`;
  }
  const completed = attendance.voted.length;
  const ratio = attendance.eligible ? Math.round((completed / attendance.eligible) * 100) : 0;
  return `<section class="attendance-panel">
    <div class="attendance-summary">
      <div class="eyebrow">Live attendance · ${escapeHtml(attendance.teamName)}</div>
      <h2>투표 현황 <span>${completed} / ${attendance.eligible}</span></h2>
      <div class="progress-track light"><span style="width:${ratio}%"></span></div>
      <button class="ghost-btn refresh-btn" data-action="refresh">↻ 현황 새로고침</button>
    </div>
    <div class="nonvoter-list">
      <div class="nonvoter-head"><strong>아직 투표하지 않은 사람</strong><span>${attendance.notVoted.length}명</span></div>
      ${attendance.notVoted.length
        ? attendance.notVoted.map((person) => `<div class="person-row"><span class="avatar small">${escapeHtml(person.name.slice(0, 1))}</span><div><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.teamName)} · ${escapeHtml(person.email)}</small></div></div>`).join('')
        : '<div class="all-voted">✓ 대상자 전원이 투표를 완료했습니다.</div>'}
    </div>
  </section>`;
}

function operatorTeamCard(team) {
  if (team.evaluatorOnly) {
    return `<article class="team-card evaluator-team-card" style="--team-color:${team.color}">
      <div class="team-meta"><span class="team-number">REVIEW PANEL</span><span class="mini-state own">평가단</span></div>
      <h3>${escapeHtml(team.name)}</h3>
      <div class="team-code-tools"><button class="team-code" data-action="copy-team-code" data-id="${team.id}" title="참가 코드 복사"><span>JOIN CODE</span><strong>${escapeHtml(team.code)}</strong>${icon('copy')}</button><button class="team-code-edit" data-action="edit-team-code" data-id="${team.id}">코드 변경</button></div>
      <p>발표와 순위에서 제외되며, 소속 인원은 모든 발표 팀을 평가할 수 있습니다.</p>
      <div class="material-count">가입 인원 <strong>${team.memberCount}</strong>명</div>
      <button class="danger-btn" data-action="delete-team" data-id="${team.id}">평가단 삭제</button>
    </article>`;
  }
  const evaluationCount = team.participantVoteCount;
  return `<article class="team-card ${team.isActive ? 'active-team' : ''}" style="--team-color:${team.color}">
    <div class="team-meta"><span class="team-number">TEAM / ${String(team.order).padStart(2, '0')}</span><span class="mini-state ${team.isActive || team.published ? 'done' : ''}">${team.isActive ? '현재 투표 팀' : team.published ? '공개됨' : '준비 중'}</span></div>
    <h3>${escapeHtml(team.name)}</h3>
    <div class="team-code-tools"><button class="team-code" data-action="copy-team-code" data-id="${team.id}" title="참가 코드 복사"><span>JOIN CODE</span><strong>${escapeHtml(team.code)}</strong>${icon('copy')}</button><button class="team-code-edit" data-action="edit-team-code" data-id="${team.id}">코드 변경</button></div>
    ${team.presentation ? `<div class="project-name">${escapeHtml(team.presentation.title)}</div><p>${escapeHtml(team.presentation.summary)}</p>` : '<p>프로젝트 이름과 소개를 등록하면 참가자 대시보드에 즉시 공개됩니다.</p>'}
    <div class="material-count">발표자료 <strong>${team.materials.length}</strong> / 5</div>
    <div class="team-actions">
      <button class="secondary-btn" data-action="publish" data-id="${team.id}">${icon('edit')} ${team.published ? '발표 수정' : '발표 공개'}</button>
      <button class="secondary-btn" data-action="materials" data-id="${team.id}">자료 관리</button>
      ${team.published ? `<button class="secondary-btn" data-action="result" data-id="${team.id}">${icon('chart')} 결과·의견</button>` : ''}
    </div>
    ${team.published ? `<div class="team-actions voting-action"><button class="${team.isActive ? 'secondary-btn' : 'primary-btn accent'}" data-action="activate-team" data-id="${team.id}" ${team.isActive ? 'disabled' : ''}>${team.isActive ? `${icon('check')} 현재 투표 진행 팀` : `이 팀 투표 시작 ${icon('arrow')}`}</button></div>` : ''}
    ${team.published ? `<button class="reset-team-votes" data-action="unpublish" data-id="${team.id}">발표 공개 전으로 돌리기</button>` : ''}
    ${evaluationCount ? `<button class="reset-team-votes" data-action="reset-team-votes" data-id="${team.id}">이 팀 익명 평가 ${evaluationCount}건 초기화</button>` : ''}
    <button class="danger-btn" data-action="delete-team" data-id="${team.id}">팀 삭제</button>
  </article>`;
}

function materialLinks(team) {
  return `<div class="material-links">${team.materials.map((material) => `
    <button type="button" class="material-link" data-action="open-material" data-id="${material.id}" data-name="${escapeHtml(material.originalName)}">
      <span class="file-badge">${escapeHtml(fileExtension(material.originalName))}</span>
      <span>${escapeHtml(material.originalName)}<small>${formatBytes(material.size)}</small></span>
      <b>↗</b>
    </button>`).join('')}</div>`;
}

function fileExtension(name) {
  return String(name).split('.').pop().slice(0, 4).toUpperCase() || 'FILE';
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function rankRow(team, index) {
  const score = team.results.combined || 0;
  return `<div class="rank-row">
    <span class="rank-num">${String(index + 1).padStart(2, '0')}</span>
    <div class="rank-team"><strong>${escapeHtml(team.name)}</strong><span>${escapeHtml(team.presentation.title)} · ${team.participantVoteCount}표</span></div>
    <div class="rank-bar"><span style="width:${(score / 5) * 100}%"></span></div>
    <div class="rank-score">${score.toFixed(2)}</div>
  </div>`;
}

function scoreFields(values = {}) {
  let currentStage = '';
  return scoreMeta.map(([key, label, description, stage]) => {
    const heading = stage !== currentStage ? `<div class="score-stage"><span>${escapeHtml(stage)}</span></div>` : '';
    currentStage = stage;
    return `${heading}
    <div class="score-field">
      <div class="score-label"><strong>${label}</strong><span>${description}</span></div>
      <div class="score-options">
        ${[1,2,3,4,5].map((score) => `<span><input type="radio" id="${key}-${score}" name="${key}" value="${score}" ${Number(values[key]) === score ? 'checked' : ''} required><label for="${key}-${score}">${score}</label></span>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function openModal(type, teamId) {
  const root = document.querySelector('#modal-root');
  if (type === 'account') {
    root.innerHTML = accountModal();
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => root.querySelector('input')?.focus(), 0);
    return;
  }
  if (type === 'add-team') {
    root.innerHTML = teamModal();
    document.body.style.overflow = 'hidden';
    return;
  }
  const team = state.dashboard.teams.find((item) => item.id === teamId);
  if (!team) return;
  if (type === 'vote') root.innerHTML = voteModal(team);
  if (type === 'publish') root.innerHTML = publishModal(team);
  if (type === 'materials') root.innerHTML = materialsModal(team);
  if (type === 'result') root.innerHTML = resultModal(team);
  if (type === 'detail') root.innerHTML = detailModal(team);
  if (type === 'team-code') root.innerHTML = teamCodeModal(team);
  document.body.style.overflow = 'hidden';
}

function accountModal() {
  return modalShell('Account security', '비밀번호 변경', `
    <div class="project-brief"><strong>${escapeHtml(state.user.email)}</strong>변경 후 현재 기기를 제외한 다른 기기에서는 자동으로 로그아웃됩니다.</div>
    <form id="password-form">
      <div class="field"><label for="current-password">현재 비밀번호</label><input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="new-password">새 비밀번호</label><input id="new-password" name="newPassword" type="password" minlength="12" autocomplete="new-password" placeholder="12자 이상 입력" required></div>
      <div class="field"><label for="confirm-password">새 비밀번호 확인</label><input id="confirm-password" name="confirmPassword" type="password" minlength="12" autocomplete="new-password" required></div>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">취소</button><button type="submit" class="primary-btn">비밀번호 변경 ${icon('arrow')}</button></div>
    </form>`);
}

function teamModal() {
  return modalShell('Team management', '새 팀 추가', `
    <form id="team-form">
      <div class="field"><label for="new-team-name">팀 이름</label><input id="new-team-name" name="name" maxlength="40" placeholder="예: Rocket Lab" required></div>
      <div class="field"><label for="new-team-code">참가 코드</label><input id="new-team-code" name="code" minlength="4" maxlength="20" pattern="[A-Za-z0-9-]+" placeholder="예: ROCKET26" required><span class="field-hint">참가자가 가입할 때 사용할 고유 코드입니다.</span></div>
      <div class="field"><label for="new-team-color">팀 색상</label><div class="color-picker"><input id="new-team-color" name="color" type="color" value="#f05a2a"><span>팀 카드와 상태 표시에 사용됩니다.</span></div></div>
      <label class="option-toggle"><input type="checkbox" name="evaluatorOnly"><span><strong>평가단으로 참여</strong><small>선생님·대학생처럼 발표 없이 심사에만 참여하며 발표 순서와 순위에서 제외됩니다.</small></span></label>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">취소</button><button type="submit" class="primary-btn lime">팀 추가 ${icon('arrow')}</button></div>
    </form>`);
}

function teamCodeModal(team) {
  return modalShell(`${team.name} / join code`, '참가 코드 변경', `
    <div class="project-brief"><strong>현재 코드 · ${escapeHtml(team.code)}</strong>코드를 바꾸면 기존 참가자의 계정과 데이터는 그대로 유지됩니다. 앞으로 가입하는 참가자에게는 새 코드를 전달해 주세요.</div>
    <form id="team-code-form" data-team-id="${team.id}">
      <div class="field"><label for="managed-team-code">새 참가 코드</label><input id="managed-team-code" name="code" minlength="4" maxlength="20" pattern="[A-Za-z0-9-]+" value="${escapeHtml(team.code)}" autocomplete="off" required><span class="field-hint">영문 대문자, 숫자, 하이픈으로 4~20자 · 입력한 영문은 자동으로 대문자로 저장됩니다.</span></div>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">취소</button><button type="submit" class="primary-btn">코드 변경 ${icon('arrow')}</button></div>
    </form>`);
}

async function openUserManagement() {
  const result = await api('/api/users');
  state.managedUsers = result.users;
  const root = document.querySelector('#modal-root');
  root.innerHTML = usersModal(result.users);
  document.body.style.overflow = 'hidden';
}

function usersModal(users) {
  const list = users.length ? users.map((user) => `
    <div class="user-manage-row">
      <span class="avatar small">${escapeHtml(user.name.slice(0, 1))}</span>
      <div class="user-manage-copy"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></div>
      <span class="user-team-chip">${escapeHtml(user.teamName || '소속 없음')}</span>
      <div class="user-manage-actions">
        <button class="secondary-btn small-btn" type="button" data-action="edit-user" data-id="${user.id}">수정</button>
        <button class="danger-text-btn" type="button" data-action="delete-user" data-id="${user.id}">삭제</button>
      </div>
    </div>`).join('') : '<div class="empty-materials">가입한 참가자가 없습니다.</div>';
  return modalShell('Participant management', '이용자 관리', `
    <div class="project-brief"><strong>참가자 ${users.length}명</strong>이름·이메일·소속 팀을 수정하거나 임시 비밀번호를 설정할 수 있습니다. 계정을 삭제하면 해당 참가자가 작성한 점수와 코멘트도 함께 삭제됩니다.</div>
    <div class="user-manage-list">${list}</div>
    <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">닫기</button></div>`);
}

function editUserModal(user) {
  const teamOptions = state.dashboard.teams.map((team) => `
    <option value="${team.id}" ${team.id === user.teamId ? 'selected' : ''}>${escapeHtml(team.name)}${team.evaluatorOnly ? ' · 평가단' : ''}</option>`).join('');
  return modalShell('Participant management', '이용자 정보 수정', `
    <form id="user-form" data-user-id="${user.id}">
      <div class="field"><label for="managed-user-name">이름</label><input id="managed-user-name" name="name" maxlength="30" value="${escapeHtml(user.name)}" required></div>
      <div class="field"><label for="managed-user-email">이메일</label><input id="managed-user-email" name="email" type="email" maxlength="120" value="${escapeHtml(user.email)}" required></div>
      <div class="field"><label for="managed-user-team">소속 팀</label><select id="managed-user-team" name="teamId" required>${teamOptions}</select></div>
      <div class="field"><label for="managed-user-password">새 임시 비밀번호 <span style="color:var(--muted);font-weight:400">(선택)</span></label><input id="managed-user-password" name="newPassword" type="password" minlength="8" autocomplete="new-password" placeholder="변경할 때만 8자 이상 입력"><span class="field-hint">입력하지 않으면 기존 비밀번호가 유지됩니다.</span></div>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="back-to-users">목록으로</button><button type="submit" class="primary-btn">수정 저장 ${icon('arrow')}</button></div>
    </form>`);
}

function materialsModal(team) {
  const list = team.materials.length ? team.materials.map((material) => `
    <div class="material-manage-row">
      <span class="file-badge">${escapeHtml(fileExtension(material.originalName))}</span>
      <div><strong>${escapeHtml(material.originalName)}</strong><small>${formatBytes(material.size)}</small></div>
      <button class="ghost-btn" type="button" data-action="download-material" data-id="${material.id}" data-name="${escapeHtml(material.originalName)}" aria-label="내려받기">↓</button>
      <button class="delete-file" type="button" data-action="delete-material" data-id="${material.id}" data-team-id="${team.id}" aria-label="삭제">×</button>
    </div>`).join('') : '<div class="empty-materials">등록된 발표자료가 없습니다.</div>';
  return modalShell(`${team.name} / materials`, '발표자료 관리', `
    <div class="material-manage-list">${list}</div>
    <form id="material-form" data-team-id="${team.id}">
      <label class="upload-zone" for="material-file">
        <strong>업로드할 파일을 선택하세요.</strong>
        <span>PDF, PPT, Word, Excel, HWP/HWPX, TXT/MD/CSV, 이미지, ZIP · 최대 10MB · 최대 5개</span>
        <input id="material-file" name="file" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.hwp,.hwpx,.txt,.md,.csv,.zip,.png,.jpg,.jpeg,.webp,.gif" ${team.materials.length >= 5 ? 'disabled' : ''} required>
      </label>
      <div class="selected-file" id="selected-file">선택된 파일 없음</div>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">닫기</button><button type="submit" class="primary-btn" ${team.materials.length >= 5 ? 'disabled' : ''}>자료 업로드 ${icon('arrow')}</button></div>
    </form>`);
}

function modalShell(kicker, title, content) {
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true">
    <header class="modal-head"><div><div class="eyebrow">${escapeHtml(kicker)}</div><h2>${escapeHtml(title)}</h2></div><button class="close-btn" data-action="close-modal" aria-label="닫기">×</button></header>
    <div class="modal-body">${content}</div>
  </section></div>`;
}

function voteModal(team) {
  const vote = team.myVote;
  return modalShell(`${team.name} / peer review`, vote ? '평가 수정하기' : '팀 평가하기', `
    <div class="project-brief"><strong>${escapeHtml(team.presentation.title)}</strong>${escapeHtml(team.presentation.summary)}</div>
    ${!state.dashboard.event.votingOpen ? '<div class="project-brief"><strong>투표가 마감되었습니다.</strong>운영자가 투표를 다시 열기 전에는 수정할 수 없습니다.</div>' : ''}
    <form id="vote-form" data-team-id="${team.id}">
      ${scoreFields(vote?.scores)}
      <div class="field" style="margin-top:20px"><label for="vote-comment">한 줄 평가</label><textarea id="vote-comment" name="comment" minlength="3" maxlength="300" placeholder="가장 강한 점 1가지 + 가장 보완해야 할 점 1가지를 적어 주세요." required>${escapeHtml(vote?.comment || '')}</textarea></div>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">취소</button><button type="submit" class="primary-btn accent" ${!state.dashboard.event.votingOpen ? 'disabled' : ''}>${vote ? '평가 수정' : '평가 제출'} ${icon('arrow')}</button></div>
    </form>`);
}

function detailModal(team) {
  const presentation = team.presentation;
  const materialSection = team.materials.length
    ? materialLinks(team)
    : '<div class="empty-materials">등록된 발표자료가 없습니다.</div>';
  return modalShell(`${team.name} / presentation`, presentation.title, `
    <section class="presentation-detail">
      <h3>프로젝트 소개</h3>
      <p>${escapeHtml(presentation.summary)}</p>
      ${presentation.details ? `<h3>발표 내용</h3><p class="preserve-lines">${escapeHtml(presentation.details)}</p>` : ''}
    </section>
    <div class="section-title material-section-title"><div><h2>발표자료</h2><p>파일을 누르면 새 창에서 열립니다.</p></div><span>${team.materials.length}개</span></div>
    ${materialSection}
    <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">닫기</button></div>`);
}

function publishModal(team) {
  const presentation = team.presentation || {};
  return modalShell(`${team.name} / presentation`, team.published ? '발표 정보 수정' : '발표 공개하기', `
    <form id="publish-form" data-team-id="${team.id}">
      <div class="publish-form-grid">
        <div class="field full"><label for="project-title">프로젝트명</label><input id="project-title" name="title" maxlength="80" value="${escapeHtml(presentation.title || '')}" placeholder="프로젝트 이름" required></div>
        <div class="field full"><label for="project-summary">프로젝트 소개</label><textarea id="project-summary" name="summary" minlength="10" maxlength="500" placeholder="해결하려는 문제와 핵심 기능을 소개해 주세요." required>${escapeHtml(presentation.summary || '')}</textarea></div>
        <div class="field full"><label for="project-details">발표 내용 <span style="color:var(--muted);font-weight:400">(선택)</span></label><textarea id="project-details" name="details" maxlength="3000" placeholder="문제 정의, 해결 방법, 주요 기능, 기대 효과 등 참가자가 볼 내용을 자세히 적어 주세요.">${escapeHtml(presentation.details || '')}</textarea></div>
      </div>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">취소</button><button type="submit" class="primary-btn lime">${team.published ? '수정 내용 저장' : '참가자에게 공개'} ${icon('arrow')}</button></div>
    </form>`);
}

function resultModal(team) {
  const participant = team.results.participant;
  const detail = scoreMeta.map(([key, label]) => `<div><span>${label}</span><strong>${participant[key].toFixed(1)}</strong></div>`).join('');
  const participantReviews = team.participantReviews?.length
    ? team.participantReviews.map(individualReview).join('')
    : '<div class="empty-state compact"><strong>아직 참가자 심사가 없습니다.</strong>참가자가 투표하면 익명 점수와 의견이 표시됩니다.</div>';
  return modalShell(`${team.name} / live result`, '평가 결과', `
    <div class="result-box"><div class="result-total">${team.results.combined.toFixed(2)}</div><div class="result-lines">${detail}<div><span>참여</span><strong>익명 평가 ${team.participantVoteCount}건</strong></div></div></div>
    <div class="section-title review-section-title"><div><h2>완전 익명 심사평</h2><p>작성자 정보와 제출 시각을 저장 결과에서 분리했습니다.</p></div></div>
    <div class="individual-review-list">${participantReviews}</div>`);
}

function individualReview(review) {
  const scoreDetail = scoreMeta.map(([key, label]) => `<li><span>${escapeHtml(label.replace(/^Q\d+\.\s*/, ''))}</span><strong>${Number(review.scores[key] || 0)}점</strong></li>`).join('');
  return `<article class="individual-review">
    <header><div><strong>${escapeHtml(review.anonymousLabel)}</strong><span>작성자 정보 완전 비공개</span></div><b>${average(review.scores).toFixed(1)}</b></header>
    <p>${escapeHtml(review.comment || '작성된 한 줄 평가가 없습니다.')}</p>
    <details><summary>항목별 점수 보기</summary><ul>${scoreDetail}</ul></details>
  </article>`;
}

function average(scores) {
  return scoreMeta.reduce((sum, [key]) => sum + Number(scores[key] || 0), 0) / scoreMeta.length;
}

function closeModal() {
  const root = document.querySelector('#modal-root');
  if (root) root.innerHTML = '';
  document.body.style.overflow = '';
}

async function handleAuthSubmit(form, endpoint) {
  const button = form.querySelector('[type="submit"]');
  const errorElement = form.querySelector('.form-error');
  errorElement.textContent = '';
  setButtonLoading(button, true);
  try {
    const values = Object.fromEntries(new FormData(form));
    const data = await api(endpoint, { method: 'POST', body: JSON.stringify(values) });
    if (endpoint === '/api/register') {
      toast(data.message);
      state.authMode = 'login';
      renderAuth();
      document.querySelector('#login-email').value = values.email;
    } else {
      window.sessionStorage.setItem(SESSION_KEY, data.token);
      state.user = data.user;
      await loadDashboard();
    }
  } catch (error) {
    errorElement.textContent = error.message;
    setButtonLoading(button, false);
  }
}

function formScores(form) {
  const data = new FormData(form);
  return Object.fromEntries(scoreMeta.map(([key]) => [key, Number(data.get(key))]));
}

async function handleModalSubmit(form, kind) {
  const button = form.querySelector('[type="submit"]');
  const errorElement = form.querySelector('.form-error');
  const teamId = form.dataset.teamId;
  setButtonLoading(button, true, '저장 중');
  try {
    const values = Object.fromEntries(new FormData(form));
    let url;
    let payload;
    if (kind === 'publish') {
      url = `/api/teams/${teamId}/presentation`;
      payload = { title: values.title, summary: values.summary, details: values.details };
    } else {
      url = `/api/teams/${teamId}/${kind}`;
      payload = { scores: formScores(form), comment: values.comment };
    }
    const result = await api(url, { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    toast(result.message || (kind === 'publish' ? '발표 정보가 공개되었습니다.' : '저장되었습니다.'));
    await loadDashboard();
  } catch (error) {
    errorElement.textContent = error.message;
    setButtonLoading(button, false);
  }
}

async function handleTeamSubmit(form) {
  const button = form.querySelector('[type="submit"]');
  const errorElement = form.querySelector('.form-error');
  setButtonLoading(button, true, '추가 중');
  try {
    const values = Object.fromEntries(new FormData(form));
    const result = await api('/api/teams', { method: 'POST', body: JSON.stringify(values) });
    closeModal();
    toast(result.message);
    await loadDashboard();
  } catch (error) {
    errorElement.textContent = error.message;
    setButtonLoading(button, false);
  }
}

async function handleTeamCodeSubmit(form) {
  const button = form.querySelector('[type="submit"]');
  const errorElement = form.querySelector('.form-error');
  const values = Object.fromEntries(new FormData(form));
  setButtonLoading(button, true, '변경 중');
  try {
    const result = await api(`/api/teams/${form.dataset.teamId}/code`, {
      method: 'PATCH',
      body: JSON.stringify({ code: values.code })
    });
    closeModal();
    toast(result.message);
    await loadDashboard();
  } catch (error) {
    errorElement.textContent = error.message;
    setButtonLoading(button, false);
  }
}

async function handleUserSubmit(form) {
  const button = form.querySelector('[type="submit"]');
  const errorElement = form.querySelector('.form-error');
  const values = Object.fromEntries(new FormData(form));
  setButtonLoading(button, true, '저장 중');
  try {
    const result = await api(`/api/users/${form.dataset.userId}`, {
      method: 'PATCH',
      body: JSON.stringify(values)
    });
    toast(result.message);
    await loadDashboard();
    await openUserManagement();
  } catch (error) {
    errorElement.textContent = error.message;
    setButtonLoading(button, false);
  }
}

async function handlePasswordSubmit(form) {
  const button = form.querySelector('[type="submit"]');
  const errorElement = form.querySelector('.form-error');
  const values = Object.fromEntries(new FormData(form));
  errorElement.textContent = '';
  if (values.newPassword !== values.confirmPassword) {
    errorElement.textContent = '새 비밀번호가 서로 일치하지 않습니다.';
    return;
  }
  setButtonLoading(button, true, '변경 중');
  try {
    const result = await api('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword })
    });
    if (result.token) window.sessionStorage.setItem(SESSION_KEY, result.token);
    closeModal();
    toast(result.message);
  } catch (error) {
    errorElement.textContent = error.message;
    setButtonLoading(button, false);
  }
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

async function downloadProtectedFile(url, fileName, openInNewTab = false) {
  const token = window.sessionStorage.getItem(SESSION_KEY);
  const popup = openInNewTab ? window.open('', '_blank') : null;
  if (popup) popup.opener = null;
  try {
    const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || '파일을 불러오지 못했습니다.');
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    if (popup) {
      popup.location.href = objectUrl;
    } else {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

async function handleMaterialSubmit(form) {
  const button = form.querySelector('[type="submit"]');
  const errorElement = form.querySelector('.form-error');
  const file = form.querySelector('[type="file"]').files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    errorElement.textContent = '파일은 10MB 이하여야 합니다.';
    return;
  }
  setButtonLoading(button, true, '업로드 중');
  try {
    const data = await fileAsDataUrl(file);
    const result = await api(`/api/teams/${form.dataset.teamId}/materials`, {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, mimeType: file.type, data })
    });
    const teamId = form.dataset.teamId;
    toast(result.message);
    await loadDashboard();
    openModal('materials', teamId);
  } catch (error) {
    errorElement.textContent = error.message;
    setButtonLoading(button, false);
  }
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'auth-tab') {
    state.authMode = target.dataset.mode;
    renderAuth();
  }
  if (action === 'logout') {
    await api('/api/logout', { method: 'POST' });
    window.sessionStorage.removeItem(SESSION_KEY);
    stopAutoRefresh();
    state.user = null;
    state.dashboard = null;
    state.authMode = 'login';
    renderAuth();
  }
  if (action === 'account') openModal('account');
  if (action === 'add-team') openModal('add-team');
  if (action === 'edit-team-code') openModal('team-code', target.dataset.id);
  if (action === 'manage-users') {
    target.disabled = true;
    try {
      await openUserManagement();
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (action === 'edit-user') {
    const user = state.managedUsers.find((item) => item.id === target.dataset.id);
    if (user) document.querySelector('#modal-root').innerHTML = editUserModal(user);
  }
  if (action === 'back-to-users') {
    try {
      await openUserManagement();
    } catch (error) {
      toast(error.message, 'error');
    }
  }
  if (action === 'delete-user') {
    const user = state.managedUsers.find((item) => item.id === target.dataset.id);
    if (!user || !window.confirm(`${user.name} 참가자 계정을 삭제할까요?\n\n이 참가자가 작성한 모든 점수와 코멘트도 삭제되며 복구할 수 없습니다.`)) return;
    target.disabled = true;
    try {
      const result = await api(`/api/users/${user.id}`, { method: 'DELETE' });
      toast(result.message);
      await loadDashboard();
      await openUserManagement();
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (['vote', 'publish', 'materials', 'result', 'detail'].includes(action)) openModal(action, target.dataset.id);
  if (action === 'close-modal') closeModal();
  if (action === 'backdrop' && event.target === target) closeModal();
  if (action === 'copy-team-code') {
    const team = state.dashboard.teams.find((item) => item.id === target.dataset.id);
    if (!team?.code) return;
    try {
      await copyText(team.code);
      toast(`${team.name} 참가 코드를 복사했습니다.`);
    } catch {
      toast('참가 코드를 복사하지 못했습니다.', 'error');
    }
  }
  if (action === 'refresh') {
    target.disabled = true;
    try {
      await loadDashboard();
      toast('최신 투표 현황을 불러왔습니다.');
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (action === 'export-results') {
    target.disabled = true;
    try {
      await downloadProtectedFile('/api/results/export', `hackathon-results-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast('Excel 결과 파일을 만들었습니다.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      target.disabled = false;
    }
  }
  if (action === 'open-material' || action === 'download-material') {
    target.disabled = true;
    try {
      await downloadProtectedFile(`/api/materials/${target.dataset.id}/download${action === 'open-material' ? '?inline=1' : ''}`, target.dataset.name || 'material', action === 'open-material');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      target.disabled = false;
    }
  }
  if (action === 'delete-material') {
    if (!window.confirm('이 발표자료를 삭제할까요?')) return;
    target.disabled = true;
    try {
      const teamId = target.dataset.teamId;
      const result = await api(`/api/materials/${target.dataset.id}`, { method: 'DELETE' });
      toast(result.message);
      await loadDashboard();
      openModal('materials', teamId);
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (action === 'reset-team-votes') {
    const team = state.dashboard.teams.find((item) => item.id === target.dataset.id);
    const evaluationCount = team?.participantVoteCount || 0;
    if (!team || !window.confirm(`${team.name}의 익명 평가 ${evaluationCount}건을 모두 초기화할까요?\n\n모든 점수와 코멘트가 삭제되며 복구할 수 없습니다.`)) return;
    target.disabled = true;
    try {
      const result = await api(`/api/teams/${team.id}/votes`, { method: 'DELETE' });
      toast(result.message);
      await loadDashboard();
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (action === 'reset-all-votes') {
    const totalVotes = state.dashboard.teams.reduce((sum, team) => sum + team.participantVoteCount, 0);
    if (!totalVotes || !window.confirm(`전체 팀의 익명 평가 ${totalVotes}건을 모두 초기화할까요?\n\n모든 점수와 코멘트가 삭제되며 복구할 수 없습니다.`)) return;
    target.disabled = true;
    try {
      const result = await api('/api/votes', { method: 'DELETE' });
      toast(result.message);
      await loadDashboard();
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (action === 'unpublish') {
    const team = state.dashboard.teams.find((item) => item.id === target.dataset.id);
    if (!team || !window.confirm(`${team.name} 발표를 최초 상태로 돌릴까요?\n\n프로젝트명·소개·상세 내용이 삭제됩니다. 업로드 자료와 익명 평가 기록은 유지되며, 현재 투표 팀이라면 투표도 마감됩니다.`)) return;
    target.disabled = true;
    try {
      const result = await api(`/api/teams/${team.id}/presentation/unpublish`, { method: 'POST' });
      toast(result.message);
      await loadDashboard();
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (action === 'delete-team') {
    const team = state.dashboard.teams.find((item) => item.id === target.dataset.id);
    if (!window.confirm(`${team.name} 팀을 삭제할까요?\n\n소속 참가자 계정, 발표자료, 평가와 투표 데이터가 모두 삭제되며 되돌릴 수 없습니다.`)) return;
    target.disabled = true;
    try {
      const result = await api(`/api/teams/${team.id}`, { method: 'DELETE' });
      toast(result.message);
      await loadDashboard();
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (action === 'next-team') {
    if (!window.confirm('현재 팀 투표를 마치고 다음 발표 팀 투표를 시작할까요?')) return;
    target.disabled = true;
    try {
      const result = await api('/api/event/next-team', { method: 'POST' });
      toast(result.message);
      await loadDashboard();
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (action === 'activate-team') {
    const nextTeam = state.dashboard.teams.find((team) => team.id === target.dataset.id);
    const currentTeam = state.dashboard.teams.find((team) => team.id === state.dashboard.event.activeTeamId);
    if (currentTeam && currentTeam.id !== nextTeam.id
      && !window.confirm(`${currentTeam.name} 투표를 종료하고 ${nextTeam.name} 투표를 시작할까요?`)) return;
    target.disabled = true;
    try {
      await api('/api/event', {
        method: 'PATCH',
        body: JSON.stringify({ activeTeamId: nextTeam.id, votingOpen: true })
      });
      toast(`${nextTeam.name} 투표를 시작했습니다.`);
      await loadDashboard();
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
  if (action === 'toggle-voting') {
    target.disabled = true;
    try {
      await api('/api/event', { method: 'PATCH', body: JSON.stringify({ votingOpen: !state.dashboard.event.votingOpen }) });
      toast(state.dashboard.event.votingOpen ? '참가자 투표를 마감했습니다.' : '참가자 투표를 다시 열었습니다.');
      await loadDashboard();
    } catch (error) {
      target.disabled = false;
      toast(error.message, 'error');
    }
  }
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'login-form') handleAuthSubmit(event.target, '/api/login');
  if (event.target.id === 'register-form') handleAuthSubmit(event.target, '/api/register');
  if (event.target.id === 'vote-form') handleModalSubmit(event.target, 'vote');
  if (event.target.id === 'publish-form') handleModalSubmit(event.target, 'publish');
  if (event.target.id === 'team-form') handleTeamSubmit(event.target);
  if (event.target.id === 'team-code-form') handleTeamCodeSubmit(event.target);
  if (event.target.id === 'user-form') handleUserSubmit(event.target);
  if (event.target.id === 'password-form') handlePasswordSubmit(event.target);
  if (event.target.id === 'material-form') handleMaterialSubmit(event.target);
});

document.addEventListener('change', (event) => {
  if (event.target.id !== 'material-file') return;
  const label = document.querySelector('#selected-file');
  const file = event.target.files[0];
  label.textContent = file ? `${file.name} · ${formatBytes(file.size)}` : '선택된 파일 없음';
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshDashboard();
});

async function init() {
  try {
    const data = await api('/api/me');
    state.user = data.user;
    if (state.user) await loadDashboard();
    else {
      window.sessionStorage.removeItem(SESSION_KEY);
      renderAuth();
    }
  } catch (error) {
    app.innerHTML = `<div class="empty-state" style="margin:10vh auto;max-width:500px"><strong>서버에 연결할 수 없습니다.</strong>${escapeHtml(error.message)}</div>`;
  }
}

init();
