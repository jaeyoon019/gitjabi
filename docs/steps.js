// 튜토리얼 정의. 단계 추가 = 객체 하나 추가
// check(user): 통과면 true, 아직이면 falsy(→ fail 문구) 또는 실패 사유 문자열. 오류는 throw (app.js의 gh()가 처리)
const REPO = 'gitjabi-practice';          // 모든 단계가 쓰는 실습 저장소 이름
const UPLOAD_FILE = 'gitjabi-hello.txt';  // 업로드 단계 파일
const CREATE_FILE = 'gitjabi-intro.md';   // 웹에서 만들기 단계 파일
const BRANCH = 'feature/gitjabi';

// 업로드와 웹 생성은 API상 커밋 메시지 말고는 차이가 없다 (작성자·커미터·서명 모두 같음).
// 웹 생성(Create new file)의 기본 메시지는 "Create <파일명>"으로 고정이지만,
// 업로드의 기본 메시지는 일정하지 않다 ("Add files via upload"도, "Add content to <파일명>"도 실제로 나왔다).
// 그래서 "Create <파일명>"인지 아닌지 하나로 가른다
const createMsg = (file) => `Create ${file}`;

const repoLink = (user) =>
  `<a href="https://github.com/${user}/${REPO}" target="_blank" rel="noopener">github.com/${user}/${REPO}</a>`;

// 지금 있는 파일을 추가한 커밋의 메시지. 파일이 없으면 null
// 목록은 최신순. 지웠다가 다시 올린 경우를 위해, 가장 최근 "Delete <파일명>"보다 최신인 커밋만 지금 파일의 기록으로 보고 그중 가장 오래된 것을 고른다
async function addedCommitMessage(user, file) {
  const list = await gh(`/repos/${user}/${REPO}/commits?path=${encodeURIComponent(file)}&per_page=100`);
  if (!list) return null;
  const del = list.findIndex(c => c.commit.message.startsWith(`Delete ${file}`));
  const life = del === -1 ? list : list.slice(0, del);
  return life.length ? life[life.length - 1].commit.message : null;
}

const STEPS = [
  {
    id: 'create-repo',
    title: '저장소 만들기',
    guide: (user) => `
      <p>저장소(repository)는 프로젝트 파일과 변경 기록을 담는 폴더입니다.</p>
      <ol>
        <li><a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a>를 엽니다 (오른쪽 위 <b>+</b> → <b>New repository</b>)</li>
        <li>Repository name: <code>${REPO}</code></li>
        <li><b>Public</b>을 선택합니다 — Private이면 이 페이지가 확인할 수 없어요</li>
        <li><b>Add a README file</b>을 켜고 <b>Create repository</b>를 누릅니다</li>
      </ol>`,
    check: async (user) => !!(await gh(`/repos/${user}/${REPO}`)),
    fail: '저장소를 찾지 못했어요. 이름 철자와 Public 여부를 확인하세요.',
  },
  {
    id: 'upload-file',
    title: '파일 업로드',
    guide: (user) => `
      <p>내 컴퓨터에 있는 파일을 저장소에 올려 봅니다.</p>
      <ol>
        <li>메모장에 <code>깃잡이 첫 업로드</code>라고 적어 <code>${UPLOAD_FILE}</code>로 저장합니다</li>
        <li>${repoLink(user)} 에서 <b>Add file</b> → <b>Upload files</b></li>
        <li><code>${UPLOAD_FILE}</code>를 끌어다 놓고 <b>Commit changes</b>를 누릅니다</li>
      </ol>
      <p class="hint">Create new file로 만들면 안 돼요. 꼭 Upload files로 올려 주세요.</p>`,
    check: async (user) => {
      const msg = await addedCommitMessage(user, UPLOAD_FILE);
      if (!msg) return false;
      return !msg.startsWith(createMsg(UPLOAD_FILE)) ||
        `${UPLOAD_FILE}는 있는데 업로드로 올린 게 아니에요. 파일을 지우고 Add file → Upload files로 다시 올려 주세요.`;
    },
    fail: `${UPLOAD_FILE}를 찾지 못했어요. 파일 이름과, Commit changes까지 눌렀는지 확인하세요.`,
  },
  {
    id: 'create-file',
    title: '웹에서 파일 만들기',
    guide: (user) => `
      <p>이번에는 파일을 GitHub 웹 화면에서 바로 만듭니다.</p>
      <ol>
        <li>${repoLink(user)} 에서 <b>Add file</b> → <b>Create new file</b></li>
        <li>파일 이름: <code>${CREATE_FILE}</code></li>
        <li>내용에 <code>깃잡이</code>라는 단어를 넣어 자기소개를 한 줄 씁니다</li>
        <li><b>Commit changes...</b> → 다시 <b>Commit changes</b></li>
      </ol>
      <p class="hint">커밋 메시지는 기본값(<code>${createMsg(CREATE_FILE)}</code>) 그대로 두세요. 이 메시지로 "웹에서 만들었는지"를 확인해요.</p>`,
    check: async (user) => {
      const f = await gh(`/repos/${user}/${REPO}/contents/${CREATE_FILE}`);
      if (!f) return false;
      if (!decodeB64(f.content).includes('깃잡이')) return `${CREATE_FILE} 내용에 "깃잡이"가 없어요. 파일을 열어 연필(✏️) 버튼으로 고쳐 주세요.`;
      const msg = await addedCommitMessage(user, CREATE_FILE);
      return (msg && msg.startsWith(createMsg(CREATE_FILE))) ||
        `${CREATE_FILE}를 웹에서 만든 게 아니에요. 파일을 지우고 Add file → Create new file로 다시 만들어 주세요 (커밋 메시지는 기본값 그대로).`;
    },
    fail: `${CREATE_FILE}를 찾지 못했어요. 파일 이름과, Commit changes까지 눌렀는지 확인하세요.`,
  },
  {
    id: 'create-branch',
    title: '브랜치 만들기',
    guide: (user) => `
      <p>브랜치(branch)는 원본(main)을 건드리지 않고 따로 작업하는 갈래입니다.</p>
      <ol>
        <li>${repoLink(user)} 에서 왼쪽 위 <b>main</b> 버튼(브랜치 선택)을 누릅니다</li>
        <li>입력칸에 <code>${BRANCH}</code>를 입력합니다</li>
        <li><b>Create branch ${BRANCH} from main</b>을 누릅니다</li>
      </ol>`,
    check: async (user) => !!(await gh(`/repos/${user}/${REPO}/branches/${encodeURIComponent(BRANCH)}`)),
    fail: `${BRANCH} 브랜치를 찾지 못했어요. 이름에 오타가 없는지 확인하세요.`,
  },
];
