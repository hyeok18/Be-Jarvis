import { spawnSync } from "node:child_process";

const remote = process.env.GIT_REMOTE || "origin";
const baseBranch = process.env.GIT_BASE_BRANCH || "main";
const baseRef = `${remote}/${baseBranch}`;

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    const detail = (result.stderr || result.stdout || "unknown git error").trim();
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }

  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function lines(value) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function changedFiles(range) {
  return new Set(lines(runGit(["diff", "--name-only", range]).stdout));
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value)).sort();
}

function printFiles(label, files) {
  process.stderr.write(`${label}\n`);
  for (const file of files) {
    process.stderr.write(`  - ${file}\n`);
  }
}

const blockers = [];

process.stdout.write(`[push-safety] Fetching ${remote}...\n`);
runGit(["fetch", "--prune", remote]);

const branch = runGit(["branch", "--show-current"]).stdout;
if (!branch) {
  blockers.push("detached HEAD 상태입니다.");
} else if (branch === baseBranch) {
  blockers.push(`${baseBranch}에서 직접 push하지 않습니다.`);
}

const status = runGit(["status", "--porcelain=v1"]).stdout;
if (status) {
  blockers.push("커밋되지 않은 변경이 남아 있습니다.");
}

runGit(["rev-parse", "--verify", baseRef]);
const mergeBase = runGit(["merge-base", "HEAD", baseRef]).stdout;
const localFiles = changedFiles(`${mergeBase}..HEAD`);
const baseFiles = changedFiles(`${mergeBase}..${baseRef}`);
const baseOverlap = intersection(localFiles, baseFiles);

if (baseOverlap.length > 0) {
  blockers.push(`${baseRef}가 branch 생성 후 동일 파일을 수정했습니다.`);
  printFiles(`[push-safety] ${baseRef} overlap:`, baseOverlap);
}

const upstreamResult = runGit(
  ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
  { allowFailure: true },
);
const upstream = upstreamResult.ok ? upstreamResult.stdout : "";

if (upstream) {
  const [remoteOnly = "0", localOnly = "0"] = runGit([
    "rev-list",
    "--left-right",
    "--count",
    `${upstream}...HEAD`,
  ]).stdout.split(/\s+/u);

  process.stdout.write(
    `[push-safety] ${upstream}: remote-only ${remoteOnly}, local-only ${localOnly}\n`,
  );

  if (Number(remoteOnly) > 0) {
    blockers.push(`${upstream}에 로컬에 없는 commit이 있습니다.`);
  }
}

const remoteBranches = lines(
  runGit(["branch", "-r", "--no-merged", baseRef]).stdout,
)
  .map((ref) => ref.replace(/^\*\s*/u, ""))
  .filter((ref) => !ref.includes(" -> "))
  .filter((ref) => ref !== baseRef && ref !== upstream);

for (const ref of remoteBranches) {
  const refFiles = changedFiles(`${baseRef}...${ref}`);
  const overlap = intersection(localFiles, refFiles);

  if (overlap.length > 0) {
    blockers.push(`${ref}와 수정 파일이 겹칩니다. 활성 branch인지 팀 확인이 필요합니다.`);
    printFiles(`[push-safety] ${ref} overlap:`, overlap);
  }
}

const sharedFiles = [...localFiles]
  .filter((file) =>
    /^(AGENTS\.md|package\.json|(?:pnpm|package-lock|yarn)\S*|supabase\/(?:migrations\/|seed\.sql)|src\/lib\/supabase\/database\.types\.ts|src\/app\/globals\.css|docs\/(?:DEVELOPMENT_PRIORITY\.md|development-logs\/INDEX\.md))$/u.test(
      file,
    ),
  )
  .sort();

if (sharedFiles.length > 0) {
  printFiles("[push-safety] 팀 공유가 필요한 공용 파일:", sharedFiles);
}

if (blockers.length > 0) {
  process.stderr.write("[push-safety] PUSH BLOCKED\n");
  for (const blocker of blockers) {
    process.stderr.write(`  - ${blocker}\n`);
  }
  process.exit(2);
}

process.stdout.write(
  "[push-safety] PASS — GitHub 열린 PR과 팀 채팅의 활성 파일 목록을 마지막으로 대조한 뒤 일반 push를 실행하세요.\n",
);
