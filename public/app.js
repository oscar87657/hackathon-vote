const app = document.querySelector('#app');
const toastRoot = document.querySelector('#toast-root');

const state = {
  user: null,
  dashboard: null,
  authMode: 'login',
  modal: null,
  refreshTimer: null
};

const scoreMeta = [
  ['originality', '독창성', '아이디어가 새롭고 차별화되었나요?'],
  ['completion', '완성도', '핵심 기능이 안정적으로 구현되었나요?'],
  ['impact', '파급력', '실제 문제를 의미 있게 해결하나요?'],
  ['presentation', '발표력', '문제와 해결책을 명확히 전달했나요?']
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
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
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
    <div class="section-title"><div><h2>발표 팀</h2><p>운영자가 지정한 팀만 투표할 수 있습니다.</p></div><p>총점은 4개 항목의 평균으로 집계됩니다.</p></div>
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
    ${team.presentation ? `<div class="project-name">${escapeHtml(team.presentation.title)}</div><p>${escapeHtml(team.presentation.summary)}</p>` : '<p>운영자가 발표 정보를 공개하면 프로젝트 소개와 평가 버튼이 표시됩니다.</p>'}
    ${team.published && team.materials.length ? materialLinks(team) : ''}
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
  const reviewed = teams.filter((team) => team.operatorReviewCount > 0).length;
  return `<main class="page">
    ${pageHeading(`${event.title} / control room`, '운영 대시보드', '●')}
    <section class="operator-strip">
      <div class="metric"><small>발표 공개</small><strong>${stats.published}<em> / ${stats.total}</em></strong></div>
      <div class="metric"><small>운영 평가</small><strong>${reviewed}<em> / ${stats.total}</em></strong></div>
      <div class="metric"><small>참가자 투표</small><strong>${totalVotes}<em> 건</em></strong></div>
      <div class="metric"><small>참가 인원</small><strong>${stats.participants}<em> 명</em></strong></div>
    </section>
    ${operatorAttendance(attendance)}
    <div class="section-title">
      <div><h2>발표 운영</h2><p>발표 정보를 공개한 뒤 한 팀을 투표 대상으로 지정하세요.</p></div>
      <div class="admin-toolbar"><button class="primary-btn" data-action="add-team">+ 팀 추가</button><button class="secondary-btn" data-action="next-team" ${hasNextTeam ? '' : 'disabled'}>다음 팀 투표 ${icon('arrow')}</button><span class="status-chip">투표 ${event.votingOpen ? '진행' : '마감'}</span><button class="switch ${event.votingOpen ? 'on' : ''}" data-action="toggle-voting" aria-label="투표 상태 변경" ${event.activeTeamId ? '' : 'disabled'}><span></span></button></div>
    </div>
    <section class="team-grid">${teams.map(operatorTeamCard).join('')}</section>
    <div class="section-title" style="margin-top:48px"><div><h2>실시간 순위</h2><p>참가자 60% + 운영자 40% 기준입니다.</p></div><p>5점 만점</p></div>
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
  const myReview = team.operatorReviews?.find((review) => review.userId === state.user.id);
  return `<article class="team-card ${team.isActive ? 'active-team' : ''}" style="--team-color:${team.color}">
    <div class="team-meta"><span class="team-number">TEAM / ${String(team.order).padStart(2, '0')}</span><span class="mini-state ${team.isActive || team.published ? 'done' : ''}">${team.isActive ? '현재 투표 팀' : team.published ? '공개됨' : '준비 중'}</span></div>
    <h3>${escapeHtml(team.name)}</h3>
    <button class="team-code" data-action="copy-team-code" data-id="${team.id}" title="참가 코드 복사"><span>JOIN CODE</span><strong>${escapeHtml(team.code)}</strong>${icon('copy')}</button>
    ${team.presentation ? `<div class="project-name">${escapeHtml(team.presentation.title)}</div><p>${escapeHtml(team.presentation.summary)}</p>` : '<p>프로젝트 이름과 소개를 등록하면 참가자 대시보드에 즉시 공개됩니다.</p>'}
    <div class="material-count">발표자료 <strong>${team.materials.length}</strong> / 5</div>
    <div class="team-actions">
      <button class="secondary-btn" data-action="publish" data-id="${team.id}">${icon('edit')} ${team.published ? '발표 수정' : '발표 공개'}</button>
      <button class="secondary-btn" data-action="materials" data-id="${team.id}">자료 관리</button>
      ${team.published ? `<button class="primary-btn" data-action="review" data-id="${team.id}">${myReview ? icon('check') + ' 평가 수정' : '운영 평가'}</button>` : ''}
      ${team.published ? `<button class="secondary-btn" data-action="result" data-id="${team.id}" aria-label="결과 보기">${icon('chart')}</button>` : ''}
    </div>
    ${team.published ? `<div class="team-actions voting-action"><button class="${team.isActive ? 'secondary-btn' : 'primary-btn accent'}" data-action="activate-team" data-id="${team.id}" ${team.isActive ? 'disabled' : ''}>${team.isActive ? `${icon('check')} 현재 투표 진행 팀` : `이 팀 투표 시작 ${icon('arrow')}`}</button></div>` : ''}
    <button class="danger-btn" data-action="delete-team" data-id="${team.id}">팀 삭제</button>
  </article>`;
}

function materialLinks(team) {
  return `<div class="material-links">${team.materials.map((material) => `
    <a href="/api/materials/${material.id}/download" class="material-link" download>
      <span class="file-badge">${escapeHtml(fileExtension(material.originalName))}</span>
      <span>${escapeHtml(material.originalName)}<small>${formatBytes(material.size)}</small></span>
      <b>↓</b>
    </a>`).join('')}</div>`;
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
  return scoreMeta.map(([key, label, description]) => `
    <div class="score-field">
      <div class="score-label"><strong>${label}</strong><span>${description}</span></div>
      <div class="score-options">
        ${[1,2,3,4,5].map((score) => `<span><input type="radio" id="${key}-${score}" name="${key}" value="${score}" ${Number(values[key]) === score ? 'checked' : ''} required><label for="${key}-${score}">${score}</label></span>`).join('')}
      </div>
    </div>`).join('');
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
  if (type === 'review') root.innerHTML = reviewModal(team);
  if (type === 'result') root.innerHTML = resultModal(team);
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
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">취소</button><button type="submit" class="primary-btn lime">팀 추가 ${icon('arrow')}</button></div>
    </form>`);
}

function materialsModal(team) {
  const list = team.materials.length ? team.materials.map((material) => `
    <div class="material-manage-row">
      <span class="file-badge">${escapeHtml(fileExtension(material.originalName))}</span>
      <div><strong>${escapeHtml(material.originalName)}</strong><small>${formatBytes(material.size)}</small></div>
      <a class="ghost-btn" href="/api/materials/${material.id}/download" download aria-label="내려받기">↓</a>
      <button class="delete-file" type="button" data-action="delete-material" data-id="${material.id}" data-team-id="${team.id}" aria-label="삭제">×</button>
    </div>`).join('') : '<div class="empty-materials">등록된 발표자료가 없습니다.</div>';
  return modalShell(`${team.name} / materials`, '발표자료 관리', `
    <div class="material-manage-list">${list}</div>
    <form id="material-form" data-team-id="${team.id}">
      <label class="upload-zone" for="material-file">
        <strong>업로드할 파일을 선택하세요.</strong>
        <span>PDF, PPT, PPTX, PNG, JPG · 파일당 최대 10MB · 최대 5개</span>
        <input id="material-file" name="file" type="file" accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp" ${team.materials.length >= 5 ? 'disabled' : ''} required>
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
      <div class="field" style="margin-top:20px"><label for="vote-comment">응원 또는 피드백 <span style="color:var(--muted);font-weight:400">(선택)</span></label><textarea id="vote-comment" name="comment" maxlength="300" placeholder="팀에게 도움이 될 한마디를 남겨주세요.">${escapeHtml(vote?.comment || '')}</textarea></div>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">취소</button><button type="submit" class="primary-btn accent" ${!state.dashboard.event.votingOpen ? 'disabled' : ''}>${vote ? '평가 수정' : '평가 제출'} ${icon('arrow')}</button></div>
    </form>`);
}

function publishModal(team) {
  const presentation = team.presentation || {};
  return modalShell(`${team.name} / presentation`, team.published ? '발표 정보 수정' : '발표 공개하기', `
    <form id="publish-form" data-team-id="${team.id}">
      <div class="publish-form-grid">
        <div class="field"><label for="project-title">프로젝트명</label><input id="project-title" name="title" maxlength="80" value="${escapeHtml(presentation.title || '')}" placeholder="프로젝트 이름" required></div>
        <div class="field"><label for="category">분야</label><select id="category" name="category"><option value="AI" ${presentation.category === 'AI' ? 'selected':''}>AI</option><option value="WEB" ${presentation.category === 'WEB' ? 'selected':''}>Web / App</option><option value="SOCIAL" ${presentation.category === 'SOCIAL' ? 'selected':''}>소셜 임팩트</option><option value="ETC" ${presentation.category === 'ETC' ? 'selected':''}>기타</option></select></div>
        <div class="field full"><label for="project-summary">프로젝트 소개</label><textarea id="project-summary" name="summary" minlength="10" maxlength="500" placeholder="해결하려는 문제와 핵심 기능을 소개해 주세요." required>${escapeHtml(presentation.summary || '')}</textarea></div>
      </div>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">취소</button><button type="submit" class="primary-btn lime">${team.published ? '수정 내용 저장' : '참가자에게 공개'} ${icon('arrow')}</button></div>
    </form>`);
}

function reviewModal(team) {
  const review = team.operatorReviews?.find((item) => item.userId === state.user.id);
  return modalShell(`${team.name} / jury review`, review ? '운영 평가 수정' : '운영 평가 등록', `
    <div class="project-brief"><strong>${escapeHtml(team.presentation.title)}</strong>${escapeHtml(team.presentation.summary)}</div>
    <form id="review-form" data-team-id="${team.id}">
      ${scoreFields(review?.scores)}
      <div class="field" style="margin-top:20px"><label for="review-comment">심사 의견 <span style="color:var(--muted);font-weight:400">(선택)</span></label><textarea id="review-comment" name="comment" maxlength="500" placeholder="심사 의견을 기록해 주세요.">${escapeHtml(review?.comment || '')}</textarea></div>
      <div class="form-error" id="modal-error"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">취소</button><button type="submit" class="primary-btn">평가 저장 ${icon('arrow')}</button></div>
    </form>`);
}

function resultModal(team) {
  const participant = team.results.participant;
  const operator = team.results.operator;
  const detail = scoreMeta.map(([key, label]) => `<div><span>${label}</span><strong>참가자 ${participant[key].toFixed(1)} · 운영 ${operator[key].toFixed(1)}</strong></div>`).join('');
  const reviews = team.operatorReviews?.length
    ? team.operatorReviews.map((review) => `<div class="project-brief"><strong>${escapeHtml(review.operatorName)} · ${average(review.scores).toFixed(1)}점</strong>${escapeHtml(review.comment || '작성된 심사 의견이 없습니다.')}</div>`).join('')
    : '<div class="empty-state"><strong>운영 평가가 아직 없습니다.</strong>평가를 등록하면 상세 의견이 표시됩니다.</div>';
  return modalShell(`${team.name} / live result`, '평가 결과', `
    <div class="result-box"><div class="result-total">${team.results.combined.toFixed(2)}</div><div class="result-lines">${detail}<div><span>참여</span><strong>참가자 ${team.participantVoteCount}명 · 운영자 ${team.operatorReviewCount}명</strong></div></div></div>
    <div class="section-title"><div><h2>운영자 심사 의견</h2></div></div>${reviews}`);
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
      payload = { title: values.title, category: values.category, summary: values.summary };
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
    stopAutoRefresh();
    state.user = null;
    state.dashboard = null;
    state.authMode = 'login';
    renderAuth();
  }
  if (action === 'account') openModal('account');
  if (action === 'add-team') openModal('add-team');
  if (['vote', 'publish', 'materials', 'review', 'result'].includes(action)) openModal(action, target.dataset.id);
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
  if (event.target.id === 'review-form') handleModalSubmit(event.target, 'review');
  if (event.target.id === 'team-form') handleTeamSubmit(event.target);
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
    else renderAuth();
  } catch (error) {
    app.innerHTML = `<div class="empty-state" style="margin:10vh auto;max-width:500px"><strong>서버에 연결할 수 없습니다.</strong>${escapeHtml(error.message)}</div>`;
  }
}

init();
