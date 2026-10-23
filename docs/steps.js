// 연습 정의. 연습 추가 = 객체 하나 추가 (id는 저장된 진행 기록에 쓰이니 바꾸지 않는다)
// group: 목록의 묶음(가이드 목차와 같게) · needs: 먼저 끝내야 열리는 연습 id · learn: 관련 가이드 주소
// check(user): 통과면 true, 아직이면 falsy(→ fail 문구) 또는 실패 사유 문자열. 오류는 throw (app.js의 gh()가 처리)
const REPO = 'gitjabi-practice';          // 모든 연습이 쓰는 실습 repo 이름
const UPLOAD_FILE = 'gitjabi-hello.txt';  // 업로드 연습 파일
const UPLOAD_TEXT = 'gitjabi first upload';  // 업로드 파일에 넣을 문구. 영문이라 메모장 인코딩(ANSI/UTF-8)과 상관없이 읽힌다
const CREATE_FILE = 'gitjabi-intro.md';   // 웹에서 만들기 연습 파일
const BRANCH = 'feature/gitjabi';         // 웹에서 만드는 branch
const TEAM_BRANCH = 'feature/gitjabi-team';  // 터미널에서 만들어 PR까지 하는 branch. 웹 branch는 main과 내용이 같아 PR을 만들 수 없어서 따로 둔다
const TEAM_FILE = 'gitjabi-team.txt';

// 업로드와 웹 생성은 API상 커밋 메시지 말고는 차이가 없다 (작성자·커미터·서명 모두 같음).
// 웹 생성(Create new file)의 기본 메시지는 "Create <파일명>"으로 고정이지만,
// 업로드의 기본 메시지는 일정하지 않다 ("Add files via upload"도, "Add content to <파일명>"도 실제로 나왔다).
// 그래서 "Create <파일명>"인지 아닌지 하나로 가른다
const createMsg = (file) => `Create ${file}`;

const repoLink = (user) =>
  `<a href="https://github.com/${user}/${REPO}" target="_blank" rel="noopener">github.com/${user}/${REPO}</a>`;

// 지금 있는 파일을 추가한 커밋 ({ message, committer, ... }). 파일이 없으면 null. branch를 주면 그 branch 기준
// 목록은 최신순. 지웠다가 다시 올린 경우를 위해, 가장 최근 "Delete <파일명>"보다 최신인 커밋만 지금 파일의 기록으로 보고 그중 가장 오래된 것을 고른다
async function addedCommit(user, file, branch) {
  const sha = branch ? `&sha=${encodeURIComponent(branch)}` : '';
  const list = await gh(`/repos/${user}/${REPO}/commits?path=${encodeURIComponent(file)}&per_page=100${sha}`);
  if (!list) return null;
  const del = list.findIndex(c => c.commit.message.startsWith(`Delete ${file}`));
  const life = del === -1 ? list : list.slice(0, del);
  return life.length ? life[life.length - 1].commit : null;
}

// 웹 화면에서 한 커밋은 커미터가 GitHub 자신(noreply@github.com)이다. 터미널에서 push한 커밋은 각자 git config의 이메일
const WEB_COMMITTER = 'noreply@github.com';
const CLI_FILE = 'gitjabi-cli.txt';
const cmd = (...lines) => `<pre><code>${lines.join('\n')}</code></pre>`;
const PULL_FIRST = `<li>repo 폴더(<code>${REPO}</code>) 안에서, 먼저 GitHub의 최신 내용을 받아옵니다
          ${cmd('git pull')}</li>`;

const GROUPS = [
  { id: 'web', title: 'GitHub 웹에서', desc: '설치 없이 GitHub 화면에서 해 봅니다' },
  { id: 'solo', title: '개인 작업', desc: '터미널에서 파일을 고치고 기록해 올립니다' },
  { id: 'team', title: '팀 작업', desc: 'branch로 따로 작업하고 Pull Request로 합칩니다' },
];

const STEPS = [
  {
    id: 'create-repo',
    group: 'web',
    title: 'repo 만들기',
    learn: 'guide/github-site.html',
    guide: (user) => `
      <p>repo(저장소)는 프로젝트 파일과 변경 기록을 담는 곳입니다. 다른 연습은 모두 이 repo에서 합니다.</p>
      <ol>
        <li><a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a>를 엽니다 (오른쪽 위 <b>+</b> → <b>New repository</b>)</li>
        <li>Repository name: <code>${REPO}</code></li>
        <li><b>Public</b>을 선택합니다 — Private이면 이 페이지가 확인할 수 없어요</li>
        <li><b>Add a README file</b>을 켜고 <b>Create repository</b>를 누릅니다</li>
      </ol>`,
    check: async (user) => !!(await gh(`/repos/${user}/${REPO}`)),
    fail: 'repo를 찾지 못했어요. 이름 철자와 Public 여부를 확인하세요.',
  },
  {
    id: 'upload-file',
    group: 'web',
    title: '파일 업로드',
    needs: ['create-repo'],
    learn: 'guide/github-site.html',
    guide: (user) => `
      <p>내 컴퓨터에 있는 파일을 repo에 올려 봅니다.</p>
      <ol>
        <li>메모장에 <code>${UPLOAD_TEXT}</code>라고 적어 <code>${UPLOAD_FILE}</code>로 저장합니다</li>
        <li>${repoLink(user)} 에서 <b>Add file</b> → <b>Upload files</b></li>
        <li><code>${UPLOAD_FILE}</code>를 끌어다 놓고 <b>Commit changes</b>를 누릅니다</li>
      </ol>
      <p class="hint">Create new file로 만들면 안 돼요. 꼭 Upload files로 올려 주세요.</p>`,
    check: async (user) => {
      // 파일이 지금 있는지 먼저 본다. 커밋 기록만 보면 삭제 메시지를 바꿨을 때 지운 파일도 통과한다
      const f = await gh(`/repos/${user}/${REPO}/contents/${UPLOAD_FILE}`);
      if (!f) return false;
      if (!decodeB64(f.content).toLowerCase().includes(UPLOAD_TEXT))
        return `${UPLOAD_FILE} 내용에 "${UPLOAD_TEXT}"가 없어요. GitHub에서 파일을 열어 연필(✏️) 버튼으로 고쳐 주세요.`;
      const msg = (await addedCommit(user, UPLOAD_FILE))?.message;
      if (!msg) return false;
      return !msg.startsWith(createMsg(UPLOAD_FILE)) ||
        `${UPLOAD_FILE}는 있는데 업로드로 올린 게 아니에요. 파일을 지우고 Add file → Upload files로 다시 올려 주세요.`;
    },
    fail: `${UPLOAD_FILE}를 찾지 못했어요. 파일 이름과, Commit changes까지 눌렀는지 확인하세요.`,
  },
  {
    id: 'create-file',
    group: 'web',
    title: '웹에서 파일 만들기',
    needs: ['create-repo'],
    learn: 'guide/github-site.html',
    guide: (user) => `
      <p>이번에는 파일을 GitHub 웹 화면에서 바로 만듭니다.</p>
      <ol>
        <li>${repoLink(user)} 에서 <b>Add file</b> → <b>Create new file</b></li>
        <li>파일 이름: <code>${CREATE_FILE}</code></li>
        <li>내용에 <code>깃잡이</code>라는 단어를 넣어 자기소개를 한 줄 씁니다</li>
        <li><b>Commit changes...</b> → 다시 <b>Commit changes</b></li>
      </ol>
      <p class="hint">commit 메시지는 기본값(<code>${createMsg(CREATE_FILE)}</code>) 그대로 두세요. 이 메시지로 "웹에서 만들었는지"를 확인해요.</p>`,
    check: async (user) => {
      const f = await gh(`/repos/${user}/${REPO}/contents/${CREATE_FILE}`);
      if (!f) return false;
      if (!decodeB64(f.content).includes('깃잡이')) return `${CREATE_FILE} 내용에 "깃잡이"가 없어요. 파일을 열어 연필(✏️) 버튼으로 고쳐 주세요.`;
      const msg = (await addedCommit(user, CREATE_FILE))?.message;
      return (msg && msg.startsWith(createMsg(CREATE_FILE))) ||
        `${CREATE_FILE}를 웹에서 만든 게 아니에요. 파일을 지우고 Add file → Create new file로 다시 만들어 주세요 (commit 메시지는 기본값 그대로).`;
    },
    fail: `${CREATE_FILE}를 찾지 못했어요. 파일 이름과, Commit changes까지 눌렀는지 확인하세요.`,
  },
  {
    id: 'create-branch',
    group: 'web',
    title: '웹에서 branch 만들기',
    needs: ['create-repo'],
    learn: 'guide/team.html#branch',
    guide: (user) => `
      <p>branch는 원본(main)을 건드리지 않고 따로 작업하는 갈래입니다.</p>
      <ol>
        <li>${repoLink(user)} 에서 왼쪽 위 <b>main</b> 버튼(branch 선택)을 누릅니다</li>
        <li>입력칸에 <code>${BRANCH}</code>를 입력합니다</li>
        <li><b>Create branch ${BRANCH} from main</b>을 누릅니다</li>
      </ol>`,
    check: async (user) => !!(await gh(`/repos/${user}/${REPO}/branches/${encodeURIComponent(BRANCH)}`)),
    fail: `${BRANCH} branch를 찾지 못했어요. 이름에 오타가 없는지 확인하세요.`,
  },

  // ---- 여기부터 터미널. git-setup·clone은 내 PC 안의 일이라 GitHub에 흔적이 없어 확인 없이 완료로 친다 ----
  {
    id: 'git-setup',
    group: 'solo',
    title: 'Git 준비하기',
    learn: 'guide/workflow.html#windows',
    guide: () => `
      <p>이제부터는 웹 화면 대신 <b>터미널</b>에서 명령어로 GitHub를 다룹니다. 실제 협업에서는 대부분 이렇게 올려요.</p>
      <ol>
        <li><a href="https://git-scm.com/downloads" target="_blank" rel="noopener">git-scm.com/downloads</a>에서 Git을 설치합니다 (옵션은 기본값 그대로)</li>
        <li>Windows 키를 누르고 <b>Git Bash</b>를 검색해 엽니다. Git을 설치하면 함께 깔려요</li>
        <li>설치됐는지 확인합니다. <code>git version …</code>이 나오면 성공
          ${cmd('git --version')}</li>
        <li>commit에 남길 이름과 이메일을 한 번만 설정합니다
          ${cmd('git config --global user.name "내 GitHub 아이디"', 'git config --global user.email "noreply 이메일"')}</li>
      </ol>
      <p class="hint">맥은 Git Bash 대신 <b>터미널</b>(⌘ + Space → "터미널")을 쓰면 됩니다. 명령은 똑같아요.</p>
      <p class="hint"><b>이메일은 개인 주소 대신 noreply 주소를 쓰세요.</b> 공개 repo에서는 commit에 적힌 이메일을 누구나 볼 수 있어요.
        <a href="https://github.com/settings/emails" target="_blank" rel="noopener">github.com/settings/emails</a>에서
        <b>Keep my email addresses private</b>를 켜면 <code>숫자+아이디@users.noreply.github.com</code> 주소가 보여요. 그 주소를 넣으면 됩니다.</p>
      <p class="hint">이 연습은 내 컴퓨터 안의 일이라 페이지가 확인할 수 없어요. 다 했으면 [했어요]를 누르세요.</p>`,
  },
  {
    id: 'clone',
    group: 'solo',
    title: 'repo clone하기',
    needs: ['create-repo', 'git-setup'],
    learn: 'guide/team.html#start',
    guide: (user) => `
      <p>clone은 GitHub에 있는 repo를 내 컴퓨터로 통째로 복사하는 것입니다.</p>
      <ol>
        <li>Git Bash(맥은 터미널)에서 아래 명령어를 입력합니다
          ${cmd(`git clone https://github.com/${user}/${REPO}.git`)}</li>
        <li>복사된 폴더로 들어가 파일 목록을 봅니다. GitHub에 있는 파일들이 보이면 성공
          ${cmd(`cd ${REPO}`, 'ls')}</li>
      </ol>
      <p class="hint">clone도 페이지가 확인할 수 없어요. 다음 연습에서 push가 되면 clone도 제대로 된 거예요.</p>`,
  },
  {
    id: 'commit-push',
    group: 'solo',
    title: 'commit하고 push하기',
    needs: ['clone'],
    learn: 'guide/workflow.html#add-commit-push',
    guide: () => `
      <p>내 컴퓨터에서 바꾼 내용을 기록(commit)하고 GitHub로 올립니다(push).</p>
      <ol>
        ${PULL_FIRST}
        <li>새 파일을 만듭니다
          ${cmd(`echo "gitjabi cli" > ${CLI_FILE}`)}</li>
        <li>바뀐 파일을 확인합니다. <code>${CLI_FILE}</code>가 빨간색이면 아직 add 전이에요
          ${cmd('git status')}</li>
        <li>commit할 파일로 담고(add), 다시 확인합니다. 초록색으로 바뀌면 성공
          ${cmd(`git add ${CLI_FILE}`, 'git status')}</li>
        <li>메시지와 함께 기록하고(commit) GitHub로 올립니다(push)
          ${cmd(`git commit -m "${CLI_FILE} 추가"`, 'git push')}</li>
      </ol>
      <p class="hint">처음 push할 때 GitHub 로그인 창이 뜨면 로그인하세요. 한 번 로그인하면 다음부터는 안 물어봐요.</p>`,
    check: async (user) => {
      if (!(await gh(`/repos/${user}/${REPO}/contents/${CLI_FILE}`))) return false;
      const c = await addedCommit(user, CLI_FILE);
      if (!c) return false;
      return c.committer.email !== WEB_COMMITTER ||
        `${CLI_FILE}를 웹 화면에서 만든 것으로 확인됐어요. 이렇게 다시 해 주세요:\n` +
        `① GitHub에서 ${CLI_FILE}를 열어 삭제(🗑️) → Commit changes\n` +
        `② Git Bash에서 git pull\n` +
        `③ echo "gitjabi cli" > ${CLI_FILE}\n` +
        `④ git add ${CLI_FILE}\n` +
        `⑤ git commit -m "${CLI_FILE} 추가"\n` +
        `⑥ git push`;
    },
    fail: `${CLI_FILE}를 찾지 못했어요. git push까지 했는지, 오류 메시지가 없었는지 확인하세요.`,
  },
  {
    id: 'gitignore',
    group: 'solo',
    title: '.gitignore 만들기',
    needs: ['clone'],
    learn: 'guide/workflow.html#ignore',
    guide: () => `
      <p>.gitignore는 "이 파일들은 올리지 마"라고 Git에게 알려 주는 목록입니다. 운영체제가 만드는 파일이나 비밀 정보가 실수로 올라가는 걸 막아요.</p>
      <ol>
        ${PULL_FIRST}
        <li>.gitignore에 맥이 만드는 <code>.DS_Store</code>를 적습니다 (파일이 없으면 새로 만들어져요)
          ${cmd('echo ".DS_Store" >> .gitignore', 'cat .gitignore')}</li>
        <li>.gitignore도 다른 파일처럼 올려야 팀원들에게도 같은 규칙이 적용됩니다
          ${cmd('git add .gitignore', 'git commit -m ".gitignore 추가"', 'git push')}</li>
      </ol>`,
    check: async (user) => {
      const f = await gh(`/repos/${user}/${REPO}/contents/.gitignore`);
      if (!f) return false;
      if (!decodeB64(f.content).includes('.DS_Store'))
        return '.gitignore는 있는데 .DS_Store가 적혀 있지 않아요. echo ".DS_Store" >> .gitignore 후 다시 add, commit, push해 주세요.';
      const c = await addedCommit(user, '.gitignore');
      if (!c) return false;
      return c.committer.email !== WEB_COMMITTER ||
        '.gitignore를 웹 화면에서 만든 것으로 확인됐어요. GitHub에서 .gitignore를 삭제한 뒤, 터미널에서 git pull부터 다시 해 주세요.';
    },
    fail: '.gitignore를 찾지 못했어요. git push까지 했는지, 오류 메시지가 없었는지 확인하세요.',
  },

  // ---- 팀 작업: branch를 터미널에서 만들어 push하고, 웹에서 PR로 합친다 ----
  {
    id: 'branch-work',
    group: 'team',
    title: 'branch에서 작업하기',
    needs: ['clone'],
    learn: 'guide/team.html#branch',
    guide: () => `
      <p>main은 그대로 두고, 나만의 branch에서 작업해 GitHub에 올립니다. 다음 연습에서 이 branch를 Pull Request로 합쳐요.</p>
      <ol>
        ${PULL_FIRST}
        <li>branch를 만들면서 그 branch로 이동합니다. <code>*</code>가 붙은 것이 지금 branch예요
          ${cmd(`git switch -c ${TEAM_BRANCH}`, 'git branch')}</li>
        <li>파일을 만들어 commit합니다
          ${cmd(`echo "gitjabi team" > ${TEAM_FILE}`, `git add ${TEAM_FILE}`, `git commit -m "${TEAM_FILE} 추가"`)}</li>
        <li>새 branch를 GitHub에 처음 올립니다. 처음 한 번만 <code>-u origin 이름</code>을 붙여요
          ${cmd(`git push -u origin ${TEAM_BRANCH}`)}</li>
      </ol>`,
    check: async (user) => {
      if (!(await gh(`/repos/${user}/${REPO}/branches/${encodeURIComponent(TEAM_BRANCH)}`)))
        return `${TEAM_BRANCH} branch가 GitHub에 없어요. branch 이름과, git push -u origin ${TEAM_BRANCH}까지 했는지 확인하세요.`;
      const c = await addedCommit(user, TEAM_FILE, TEAM_BRANCH);
      if (!c) return `${TEAM_BRANCH} branch에 ${TEAM_FILE}가 없어요. 파일을 만들고 add, commit한 뒤 다시 push해 주세요.`;
      return c.committer.email !== WEB_COMMITTER ||
        `${TEAM_FILE}를 웹 화면에서 만든 것으로 확인됐어요. 터미널에서 만들고 commit, push해 주세요.`;
    },
  },
  {
    id: 'pull-request',
    group: 'team',
    title: 'Pull Request로 합치기',
    needs: ['branch-work'],
    learn: 'guide/team.html#pr',
    guide: (user) => `
      <p>Pull Request(PR)는 "내 branch의 작업을 main에 합쳐 주세요"라는 요청입니다. 명령어가 아니라 GitHub 화면에서 합니다.</p>
      <ol>
        <li>${repoLink(user)} 에 나타난 노란 <b>Compare &amp; pull request</b>를 누릅니다
          (안 보이면 <b>Pull requests</b> 탭 → <b>New pull request</b> → compare를 <code>${TEAM_BRANCH}</code>로)</li>
        <li>제목과 설명을 적고 <b>Create pull request</b></li>
        <li><b>Files changed</b> 탭에서 바뀐 내용을 확인합니다</li>
        <li><b>Merge pull request</b> → <b>Confirm merge</b>. 보라색 <b>Merged</b>가 보이면 성공</li>
      </ol>
      <p class="hint">합친 뒤에는 내 컴퓨터도 main으로 돌아와 새 내용을 받아 두세요.</p>
      ${cmd('git switch main', 'git pull')}`,
    check: async (user) => {
      const prs = await gh(`/repos/${user}/${REPO}/pulls?state=all&head=${encodeURIComponent(`${user}:${TEAM_BRANCH}`)}`);
      if (!prs || !prs.length) return false;
      return prs.some(p => p.merged_at) ||
        'PR은 있는데 아직 merge 전이에요. PR 화면에서 Merge pull request → Confirm merge를 눌러 주세요.';
    },
    fail: `${TEAM_BRANCH}에서 만든 PR을 찾지 못했어요. compare가 ${TEAM_BRANCH}인지 확인하세요.`,
  },
];
