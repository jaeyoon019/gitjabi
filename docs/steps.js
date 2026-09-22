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

// 지금 있는 파일을 추가한 커밋 ({ message, committer, ... }). 파일이 없으면 null
// 목록은 최신순. 지웠다가 다시 올린 경우를 위해, 가장 최근 "Delete <파일명>"보다 최신인 커밋만 지금 파일의 기록으로 보고 그중 가장 오래된 것을 고른다
async function addedCommit(user, file) {
  const list = await gh(`/repos/${user}/${REPO}/commits?path=${encodeURIComponent(file)}&per_page=100`);
  if (!list) return null;
  const del = list.findIndex(c => c.commit.message.startsWith(`Delete ${file}`));
  const life = del === -1 ? list : list.slice(0, del);
  return life.length ? life[life.length - 1].commit : null;
}

// 웹 화면에서 한 커밋은 커미터가 GitHub 자신(noreply@github.com)이다. cmd에서 push한 커밋은 각자 git config의 이메일
const WEB_COMMITTER = 'noreply@github.com';
const CLI_FILE = 'gitjabi-cli.txt';
const cmd = (...lines) => `<pre><code>${lines.join('\n')}</code></pre>`;

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
      // 파일이 지금 있는지 먼저 본다. 커밋 기록만 보면 삭제 메시지를 바꿨을 때 지운 파일도 통과한다
      if (!(await gh(`/repos/${user}/${REPO}/contents/${UPLOAD_FILE}`))) return false;
      const msg = (await addedCommit(user, UPLOAD_FILE))?.message;
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
      const msg = (await addedCommit(user, CREATE_FILE))?.message;
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

  // ---- 여기부터 cmd(명령 프롬프트). 5·6단계는 내 PC 안의 일이라 GitHub에 흔적이 없어 확인 없이 넘어간다 ----
  {
    id: 'git-setup',
    title: 'Git 준비하기',
    guide: () => `
      <p>이제부터는 웹 화면 대신 <b>cmd(명령 프롬프트)</b>에서 명령어로 GitHub를 다룹니다. 실제 협업에서는 대부분 이렇게 올려요.</p>
      <ol>
        <li><a href="https://git-scm.com/downloads" target="_blank" rel="noopener">git-scm.com/downloads</a>에서 Git을 설치합니다 (옵션은 기본값 그대로)</li>
        <li><b>Win + R</b> → <code>cmd</code> 입력 → Enter로 cmd 창을 엽니다</li>
        <li>설치됐는지 확인합니다. <code>git version …</code>이 나오면 성공
          ${cmd('git --version')}</li>
        <li>커밋에 남길 내 이름과 이메일을 한 번만 설정합니다 (GitHub 아이디와 가입 이메일)
          ${cmd('git config --global user.name "내 GitHub 아이디"', 'git config --global user.email "가입 이메일"')}</li>
      </ol>
      <p class="hint">이 단계는 내 컴퓨터 안의 일이라 페이지가 확인할 수 없어요. 다 했으면 [다음]을 누르세요.</p>`,
  },
  {
    id: 'clone',
    title: '저장소 클론하기',
    guide: (user) => `
      <p>클론(clone)은 GitHub에 있는 저장소를 내 컴퓨터로 통째로 복사하는 것입니다.</p>
      <ol>
        <li>cmd에서 아래 명령어를 입력합니다
          ${cmd(`git clone https://github.com/${user}/${REPO}.git`)}</li>
        <li>복사된 폴더로 들어가 파일 목록을 봅니다. 지금까지 올린 파일들이 보이면 성공
          ${cmd(`cd ${REPO}`, 'dir')}</li>
      </ol>
      <p class="hint">클론도 페이지가 확인할 수 없어요. 다음 단계에서 푸시가 되면 클론도 제대로 된 거예요.</p>`,
  },
  {
    id: 'commit-push',
    title: '커밋하고 푸시하기',
    guide: () => `
      <p>내 컴퓨터에서 바꾼 내용을 기록(커밋)하고 GitHub로 올립니다(푸시).</p>
      <ol>
        <li>클론한 폴더(<code>${REPO}</code>) 안에서 새 파일을 만듭니다
          ${cmd(`echo gitjabi cli > ${CLI_FILE}`)}</li>
        <li>바뀐 파일을 확인합니다. <code>${CLI_FILE}</code>가 빨간색으로 보여요
          ${cmd('git status')}</li>
        <li>커밋할 파일로 담고(add), 메시지와 함께 기록합니다(commit)
          ${cmd(`git add ${CLI_FILE}`, `git commit -m "Add ${CLI_FILE}"`)}</li>
        <li>GitHub로 올립니다
          ${cmd('git push')}</li>
      </ol>
      <p class="hint">처음 푸시할 때 GitHub 로그인 창이 뜨면 로그인하세요. 한 번 로그인하면 다음부터는 안 물어봐요.</p>`,
    check: async (user) => {
      if (!(await gh(`/repos/${user}/${REPO}/contents/${CLI_FILE}`))) return false;
      const c = await addedCommit(user, CLI_FILE);
      if (!c) return false;
      return c.committer.email !== WEB_COMMITTER ||
        `${CLI_FILE}를 웹 화면에서 만들었어요. GitHub에서 파일을 지우고, cmd에서 git pull 후 다시 커밋·푸시해 주세요.`;
    },
    fail: `${CLI_FILE}를 찾지 못했어요. git push까지 했는지, 오류 메시지가 없었는지 확인하세요.`,
  },
];
