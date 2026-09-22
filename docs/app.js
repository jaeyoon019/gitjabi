// 상태 관리 · 화면 전환 · GitHub API 호출
const STORE_KEY = 'gitjabi.progress';     // { user, step }
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
let state = null;                         // { user, step }

function show(id) {
  for (const s of ['login', 'resume', 'step', 'done']) $(s).hidden = s !== id;
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
  return s && USER_RE.test(s.user) && Number.isInteger(s.step) && s.step >= 0 && s.step <= STEPS.length ? s : null;
}

function render() {
  say('');
  if (state.step >= STEPS.length) return show('done');
  const st = STEPS[state.step];
  $('progress-bar').style.width = `${(state.step / STEPS.length) * 100}%`;
  $('step-count').textContent = `${state.step + 1} / ${STEPS.length} 단계`;
  $('step-user').textContent = state.user;
  $('step-title').textContent = st.title;
  $('step-guide').innerHTML = st.guide(state.user);   // user는 USER_RE를 통과한 값만 들어온다
  show('step');
}

// 버튼 하나 = 그 단계 확인 한 번 (단계에 따라 API 1~2회). 처리 중에는 다시 못 누르게 막는다
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
  state = { user: u.login, step: 0 };      // 대소문자는 GitHub에 등록된 대로
  save();
  render();
});
$('user-input').onkeydown = (e) => { if (e.key === 'Enter') $('login-btn').click(); };

$('check-btn').onclick = () => busy($('check-btn'), async () => {
  const st = STEPS[state.step];
  const res = await st.check(state.user);
  if (res !== true) return say(typeof res === 'string' ? res : st.fail, 'error');   // 문자열이면 구체적 실패 사유
  state.step++;
  save();
  render();
  if (state.step < STEPS.length) say(`✅ "${st.title}" 확인 완료!`, 'ok');
});

$('resume-btn').onclick = render;
$('switch-btn').onclick = startLogin;
$('switch-btn2').onclick = startLogin;
$('restart-btn').onclick = startLogin;

// ---- 시작 ----
state = load();
if (state) {
  $('resume-user').textContent = state.user;
  show('resume');
} else {
  show('login');
}
