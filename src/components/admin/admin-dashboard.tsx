"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import type {
  CreatorEvidenceCandidate,
  YouTubeSyncRun,
} from "@/contracts/creator-admin";

import styles from "./admin-dashboard.module.css";

type AllowlistEntry = {
  handle: string;
  title: string;
  channelUrl: string;
};

type DashboardState = "loading" | "signed-out" | "ready" | "error";

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

const evidenceStatusLabels: Record<CreatorEvidenceCandidate["status"], string> = {
  candidate: "확인 대기",
  confirmed: "방문 확정",
  rejected: "후보 거절",
  stale: "영상 상태 확인 필요",
};

const syncStatusLabels: Record<YouTubeSyncRun["status"], string> = {
  queued: "대기 중",
  running: "실행 중",
  succeeded: "성공",
  partial: "일부 성공",
  failed: "실패",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 확인 불가";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function readJson<T>(response: Response): Promise<T> {
  let value: unknown;

  try {
    value = await response.json();
  } catch {
    throw new AdminApiError("서버 응답을 확인할 수 없습니다.", response.status);
  }

  if (!response.ok) {
    const body = value as ApiErrorBody;
    throw new AdminApiError(
      body.error?.message ?? "요청을 처리하지 못했습니다.",
      response.status,
    );
  }

  return value as T;
}

function EvidenceCard({
  evidence,
  pendingId,
  onDecision,
}: {
  evidence: CreatorEvidenceCandidate;
  pendingId: string | null;
  onDecision: (
    evidenceId: string,
    decision: "confirm" | "reject",
    form: HTMLFormElement,
  ) => Promise<void>;
}) {
  const isPending = pendingId === evidence.id;
  const canDecide =
    evidence.status === "candidate" &&
    evidence.video.isActive &&
    evidence.video.privacyStatus === "public" &&
    evidence.restaurant.isActive;

  function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const decision = submitter?.value === "reject" ? "reject" : "confirm";
    void onDecision(evidence.id, decision, event.currentTarget);
  }

  return (
    <li className={styles.evidenceCard}>
      <div className={styles.cardHeading}>
        <div>
          <span className={styles.status} data-status={evidence.status}>
            {evidenceStatusLabels[evidence.status]}
          </span>
          <h3>{evidence.restaurant.name}</h3>
          <p>{evidence.restaurant.roadAddressName ?? evidence.restaurant.addressName}</p>
        </div>
        <a
          className={styles.videoLink}
          href={evidence.video.originalUrl}
          target="_blank"
          rel="noreferrer"
        >
          원본 영상 열기 <span aria-hidden="true">↗</span>
        </a>
      </div>

      <dl className={styles.metadata}>
        <div>
          <dt>영상</dt>
          <dd>{evidence.video.title}</dd>
        </div>
        <div>
          <dt>채널</dt>
          <dd>{evidence.video.channel.title}</dd>
        </div>
        <div>
          <dt>Kakao 장소 ID</dt>
          <dd>{evidence.restaurant.kakaoPlaceId}</dd>
        </div>
        <div>
          <dt>영상 상태</dt>
          <dd>
            {evidence.video.privacyStatus} · {evidence.video.isActive ? "활성" : "비활성"}
          </dd>
        </div>
        <div>
          <dt>후보 생성</dt>
          <dd>{formatDate(evidence.createdAt)}</dd>
        </div>
        <div>
          <dt>마지막 확인</dt>
          <dd>{formatDate(evidence.lastVerifiedAt)}</dd>
        </div>
      </dl>

      {evidence.confirmationNote ? (
        <p className={styles.savedNote}>처리 메모: {evidence.confirmationNote}</p>
      ) : null}

      {canDecide ? (
        <form className={styles.decisionForm} onSubmit={submitDecision}>
          <label>
            확인 메모 <span>(선택)</span>
            <textarea
              name="confirmationNote"
              maxLength={1000}
              rows={2}
              placeholder="예: 2분 15초에 식당 상호와 방문 장면 확인"
              disabled={isPending}
            />
          </label>
          <label>
            영상 시간(초) <span>(선택)</span>
            <input
              name="videoTimestampSeconds"
              type="number"
              min={0}
              max={86400}
              inputMode="numeric"
              placeholder="135"
              disabled={isPending}
            />
          </label>
          <div className={styles.decisionButtons}>
            <button
              type="submit"
              name="decision"
              value="confirm"
              className={styles.confirmButton}
              disabled={isPending}
            >
              {isPending ? "처리 중…" : "방문 확정"}
            </button>
            <button
              type="submit"
              name="decision"
              value="reject"
              className={styles.rejectButton}
              disabled={isPending}
            >
              후보 거절
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.readOnlyNotice}>
          {evidence.status === "candidate"
            ? "영상 또는 식당이 비활성 상태라 확정할 수 없습니다."
            : "처리가 끝난 후보는 읽기 전용으로 표시됩니다."}
        </p>
      )}
    </li>
  );
}

export function AdminDashboard({
  allowlist,
}: {
  allowlist: readonly AllowlistEntry[];
}) {
  const [dashboardState, setDashboardState] = useState<DashboardState>("loading");
  const [evidence, setEvidence] = useState<CreatorEvidenceCandidate[]>([]);
  const [runs, setRuns] = useState<YouTubeSyncRun[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadDashboard = useCallback(async () => {
    setMessage(null);

    try {
      const [evidenceResponse, runsResponse] = await Promise.all([
        fetch("/api/admin/creator-visits", { cache: "no-store" }),
        fetch("/api/admin/sync-runs", { cache: "no-store" }),
      ]);

      if (evidenceResponse.status === 401 || runsResponse.status === 401) {
        setDashboardState("signed-out");
        return;
      }

      const [evidenceBody, runsBody] = await Promise.all([
        readJson<{ evidence: CreatorEvidenceCandidate[] }>(evidenceResponse),
        readJson<{ runs: YouTubeSyncRun[] }>(runsResponse),
      ]);
      setEvidence(evidenceBody.evidence);
      setRuns(runsBody.runs);
      setDashboardState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "관리자 화면을 불러오지 못했습니다.");
      setDashboardState("error");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setDashboardState("loading");
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        }),
      });
      await readJson(response);
      form.reset();
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인하지 못했습니다.");
      setDashboardState("signed-out");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setEvidence([]);
    setRuns([]);
    setMessage("로그아웃했습니다.");
    setDashboardState("signed-out");
  }

  async function handleDecision(
    evidenceId: string,
    decision: "confirm" | "reject",
    form: HTMLFormElement,
  ) {
    const formData = new FormData(form);
    const timestampValue = String(formData.get("videoTimestampSeconds") ?? "").trim();
    setPendingId(evidenceId);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/creator-visits/${encodeURIComponent(evidenceId)}/${decision}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmationNote: String(formData.get("confirmationNote") ?? ""),
            videoTimestampSeconds: timestampValue ? Number(timestampValue) : null,
          }),
        },
      );
      await readJson(response);
      await loadDashboard();
      setMessage(decision === "confirm" ? "방문 근거를 확정했습니다." : "후보를 거절했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "후보를 처리하지 못했습니다.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage("YouTube 데이터를 확인하고 있습니다. 잠시 기다려 주세요.");

    try {
      const response = await fetch("/api/admin/creators/sync", { method: "POST" });
      await readJson(response);
      await loadDashboard();
      setMessage("YouTube 동기화가 끝났습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "동기화를 실행하지 못했습니다.");
    } finally {
      setSyncing(false);
    }
  }

  if (dashboardState === "loading") {
    return (
      <main className={styles.shell}>
        <div className={styles.centerState} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <p>관리자 권한과 데이터를 확인하고 있습니다.</p>
        </div>
      </main>
    );
  }

  if (dashboardState === "signed-out") {
    return (
      <main className={styles.loginShell}>
        <section className={styles.loginCard} aria-labelledby="admin-login-title">
          <p className={styles.eyebrow}>Be Jarvis · 운영 도구</p>
          <h1 id="admin-login-title">관리자 로그인</h1>
          <p>
            크리에이터 영상의 실제 방문 근거를 확인하는 팀원 전용 화면입니다.
          </p>
          {message ? <div className={styles.message} role="alert">{message}</div> : null}
          <form className={styles.loginForm} onSubmit={handleLogin}>
            <label>
              이메일
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              비밀번호
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <button type="submit">로그인</button>
          </form>
          <p className={styles.securityNote}>
            관리자 권한이 없는 일반 계정은 로그인할 수 없습니다.
          </p>
        </section>
      </main>
    );
  }

  if (dashboardState === "error") {
    return (
      <main className={styles.shell}>
        <div className={styles.centerState} role="alert">
          <h1>관리자 화면을 열지 못했습니다</h1>
          <p>{message}</p>
          <button type="button" onClick={() => void loadDashboard()}>
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  const pendingCount = evidence.reduce(
    (count, item) => count + (item.status === "candidate" ? 1 : 0),
    0,
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>WU-13 · 크리에이터 운영</p>
          <h1>방문 근거 확인</h1>
          <p>확인 전 후보는 공개 화면에 표시되지 않습니다.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={handleSync} disabled={syncing}>
            {syncing ? "동기화 중…" : "YouTube 지금 동기화"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>

      {message ? <div className={styles.message} role="status">{message}</div> : null}

      <section className={styles.summaryGrid} aria-label="운영 요약">
        <div>
          <span>확인 대기</span>
          <strong>{pendingCount}건</strong>
        </div>
        <div>
          <span>전체 후보 기록</span>
          <strong>{evidence.length}건</strong>
        </div>
        <div>
          <span>등록 채널</span>
          <strong>{allowlist.length}개</strong>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="evidence-title">
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.eyebrow}>후보 확인 큐</p>
            <h2 id="evidence-title">영상과 식당이 실제로 일치하나요?</h2>
          </div>
          <button type="button" className={styles.textButton} onClick={() => void loadDashboard()}>
            새로고침
          </button>
        </div>
        {evidence.length > 0 ? (
          <ul className={styles.evidenceList}>
            {evidence.map((item) => (
              <EvidenceCard
                key={item.id}
                evidence={item}
                pendingId={pendingId}
                onDecision={handleDecision}
              />
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            <strong>표시할 방문 후보가 없습니다.</strong>
            <p>YouTube 동기화를 실행하면 식당명이 감지된 새 영상이 여기에 나타납니다.</p>
          </div>
        )}
      </section>

      <div className={styles.bottomGrid}>
        <section className={styles.panel} aria-labelledby="allowlist-title">
          <p className={styles.eyebrow}>공식 API 대상</p>
          <h2 id="allowlist-title">등록 채널 {allowlist.length}개</h2>
          <ul className={styles.allowlist}>
            {allowlist.map((creator) => (
              <li key={creator.handle}>
                <a href={creator.channelUrl} target="_blank" rel="noreferrer">
                  <strong>{creator.title}</strong>
                  <span>{creator.handle} · YouTube 열기 ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.panel} aria-labelledby="runs-title">
          <p className={styles.eyebrow}>최근 실행 기록</p>
          <h2 id="runs-title">YouTube 동기화 로그</h2>
          {runs.length > 0 ? (
            <div className={styles.tableScroll}>
              <table className={styles.runsTable}>
                <thead>
                  <tr>
                    <th scope="col">결과</th>
                    <th scope="col">방식</th>
                    <th scope="col">영상</th>
                    <th scope="col">후보</th>
                    <th scope="col">시작</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td><span className={styles.runStatus}>{syncStatusLabels[run.status]}</span></td>
                      <td>{run.triggerKind === "manual" ? "수동" : "자동"}</td>
                      <td>{run.processedVideoCount}</td>
                      <td>{run.candidateCount}</td>
                      <td>{formatDate(run.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>아직 동기화 기록이 없습니다.</div>
          )}
        </section>
      </div>
    </main>
  );
}
