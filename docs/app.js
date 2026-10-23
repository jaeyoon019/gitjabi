// 상태 관리 · 화면 전환 · GitHub API 호출
const STORE_KEY = 'gitjabi.progress';     // { user, done: [연습 id] }  (예전 형식 { user, step }은 load()가 옮긴다)
const OLD_ORDER = ['create-repo', 'upload-file', 'create-file', 'create-branch', 'git-setup', 'clone', 'commit-push'];   // 순서대로 하던 시절의 단계 순서
const USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;  // GitHub 아이디 규칙

class RateLimit extends Error {
  constructor(reset, retryAfter) {
    super('RATE_LIMIT');
    this.reset = reset;                   // 한도가 풀리는 시각 (epoch 초)
    this.retryAfter = retryAfter;         // 2차 한도일 때 기다릴 초
  }
}

async function gh(path) {
  let r;
  try {
    r = await fetch('https://api.github.com' + path, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
  } catch {
    throw new Error('NETWORK');                            // 네트워크 오류
  }
  if (r.status === 404) return null;                       // 아직 안 함
  if (r.status === 403 || r.status === 429) {
    const remaining = r.headers.get('x-ratelimit-remaining');
    const retryAfter = r.headers.get('retry-after');
    if (remaining === '0' || retryAfter)                   // 한도 초과일 때만
      throw new RateLimit(r.headers.get('x-ratelimit-reset'), retryAfter);
  }
  if (!r.ok) throw new Error('GitHub 응답 ' + r.status);   // 한도가 아닌 403도 여기로
  return r.json();
}

// Contents API의 content는 Base64. atob()만 쓰면 한글이 깨지므로 UTF-8로 다시 디코딩한다
function decodeB64(base64) {
  const bytes = Uint8Array.from(atob(base64.replace(/\n/g, '')), c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

// ---- 화면 ----
const $ = (id) => document.getElementById(id);
let state = null;                         // { user, done }
let current = null;                       // 지금 열어 둔 연습

const byId = (id) => STEPS.find(s => s.id === id);
const isDone = (id) => state.done.includes(id);
const missing = (st) => (st.needs || []).filter(id => !isDone(id));   // 아직 안 끝낸 선행 연습

function show(id) {
  for (const s of ['login', 'resume', 'menu', 'step']) $(s).hidden = s !== id;
  // 메시지는 보이는 곳에: 목록은 길어서 위에, 나머지는 확인 버튼 가까이 아래에
  if (id === 'menu') $(id).before($('msg')); else $(id).after($('msg'));
}

function say(text, kind) {
  $('msg').textContent = text;
  $('msg').className = kind || '';
  $('msg').hidden = !text;
}

function errorText(e) {
  if (e instanceof RateLimit) {
    const sec = e.retryAfter
      ? Number(e.retryAfter)
      : Math.max(0, Number(e.reset) - Math.floor(Date.now() / 1000));
    return `GitHub 확인 횟수 한도(시간당 60회, 같은 인터넷 공유 기준)에 걸렸어요. 약 ${Math.ceil(sec / 60)}분 뒤 다시 눌러 주세요. 그동안 진행은 저장돼 있어요.`;
  }
  if (e.message === 'NETWORK') return '인터넷 연결을 확인해 주세요. GitHub에 접속하지 못했어요.';
  return `확인 중 오류가 났어요 (${e.message}). 잠시 뒤 다시 눌러 주세요.`;
}

function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

function load() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); }
  catch { localStorage.removeItem(STORE_KEY); return null; }   // 깨진 저장값 → 버리고 처음부터
  if (!s || !USER_RE.test(s.user)) return null;
  if (Number.isInteger(s.step) && s.step >= 0) return { user: s.user, done: OLD_ORDER.slice(0, s.step) };   // 예전 형식
  if (!Array.isArray(s.done)) return null;
  return { user: s.user, done: s.done.filter(id => byId(id)) };   // 없어진 연습 id는 버린다
}

function renderMenu() {
  const n = STEPS.filter(st => isDone(st.id)).length;
  $('progress-bar').style.width = `${(n / STEPS.length) * 100}%`;
  $('menu-count').textContent = `${n} / ${STEPS.length} 완료`;
  $('menu-user').textContent = state.user;
  $('all-done').hidden = n < STEPS.length;
  const box = $('menu-list');
  box.replaceChildren();
  for (const g of GROUPS) {
    const sec = document.createElement('div');
    sec.className = 'menu-group';
    const h = document.createElement('h3');
    h.textContent = g.title;
    const d = document.createElement('p');
    d.className = 'hint';
    d.textContent = g.desc;
    sec.append(h, d);
    for (const st of STEPS.filter(s => s.group === g.id)) {
      const b = document.createElement('button');
      const lack = missing(st);
      b.className = 'ex' + (isDone(st.id) ? ' done' : '');
      b.disabled = lack.length > 0;
      const t = document.createElement('strong');
      t.textContent = st.title;
      const sub = document.createElement('span');
      sub.textContent = isDone(st.id) ? '✓ 완료' : lack.length ? '🔒 먼저: ' + lack.map(id => byId(id).title).join(', ') : '시작하기 →';
      b.append(t, sub);
      b.onclick = () => openStep(st.id);
      sec.append(b);
    }
    box.append(sec);
  }
  show('menu');
}

function openStep(id) {
  const st = byId(id);
  if (missing(st).length) return;           // 잠긴 연습은 열지 않는다
  current = st;
  say('');
  $('step-title').textContent = st.title;
  $('step-guide').innerHTML = st.guide(state.user);   // user는 USER_RE를 통과한 값만 들어온다
  $('step-learn').href = st.learn;
  $('check-btn').textContent = st.check ? '완료했어요' : '했어요';   // check가 없는 연습은 확인 없이 완료
  show('step');
  window.scrollTo(0, 0);
}

// 버튼 하나 = 그 연습 확인 한 번 (연습에 따라 API 1~2회). 처리 중에는 다시 못 누르게 막는다
async function busy(btn, fn) {
  btn.disabled = true;
  try { await fn(); }
  catch (e) { say(errorText(e), 'error'); }
  finally { btn.disabled = false; }
}

function startLogin() {
  localStorage.removeItem(STORE_KEY);
  state = null;
  $('user-input').value = '';
  say('');
  show('login');
  $('user-input').focus();
}

$('login-btn').onclick = () => busy($('login-btn'), async () => {
  const id = $('user-input').value.trim().replace(/^@/, '');
  if (!USER_RE.test(id)) return say('GitHub 아이디는 영문·숫자·하이픈(-)만 쓸 수 있어요.', 'error');
  const u = await gh(`/users/${id}`);
  if (!u) return say(`"${id}" 계정을 찾지 못했어요. 철자를 확인하세요.`, 'error');
  state = { user: u.login, done: [] };      // 대소문자는 GitHub에 등록된 대로
  save();
  say('');
  renderMenu();
});
$('user-input').onkeydown = (e) => { if (e.key === 'Enter') $('login-btn').click(); };

$('check-btn').onclick = () => busy($('check-btn'), async () => {
  const st = current;
  if (st.check) {
    const res = await st.check(state.user);
    if (res !== true) return say(typeof res === 'string' ? res : st.fail, 'error');   // 문자열이면 구체적 실패 사유
  }
  if (!isDone(st.id)) state.done.push(st.id);
  save();
  renderMenu();
  say(st.check ? `✅ "${st.title}" 확인 완료!` : `"${st.title}" 완료로 표시했어요.`, 'ok');
});

$('back-btn').onclick = () => { say(''); renderMenu(); };
$('resume-btn').onclick = () => { say(''); renderMenu(); };
$('switch-btn').onclick = startLogin;
$('switch-btn2').onclick = startLogin;

// ---- 시작 ----
state = load();
if (state) {
  save();                                 // 예전 형식이었다면 새 형식으로 저장
  $('resume-user').textContent = state.user;
  show('resume');
} else {
  show('login');
}
