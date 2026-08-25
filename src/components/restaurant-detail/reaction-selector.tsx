"use client";

import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { ReactionKind } from "../../domain/types";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser-client";

import {
  readPrivateReaction,
  savePrivateReaction,
} from "./private-reaction-store";
import {
  ReactionSubmissionError,
  submitAuthenticatedReaction,
  type SubmittedReaction,
} from "./reaction-submit";
import {
  requestLocationVisitProof,
  VisitCheckInError,
  type ActiveVisitProof,
} from "./visit-check-in";

interface ReactionSelectorProps {
  restaurantId: string;
  reactionRestaurantId?: string | null;
}

type AuthStatus = "checking" | "signed_out" | "signed_in" | "unavailable";

type SaveNotice =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "local_only"; localStored: boolean }
  | {
      state: "saved";
      localStored: boolean;
      moderationStatus: SubmittedReaction["moderationStatus"];
    }
  | { state: "error"; message: string };

type VisitState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ready"; proof: ActiveVisitProof }
  | { state: "consumed" }
  | { state: "error"; message: string };

const PRIVATE_REACTION_EVENT = "be-jarvis:private-reaction-change";

const REACTIONS: readonly {
  kind: ReactionKind;
  label: string;
  symbol: string;
}[] = [
  { kind: "like", label: "좋아요", symbol: "●" },
  { kind: "okay", label: "그냥 그래요", symbol: "▲" },
  { kind: "dislike", label: "싫어요", symbol: "■" },
];

function getSavedNoticeCopy(
  moderationStatus: SubmittedReaction["moderationStatus"],
) {
  if (moderationStatus === "counted") {
    return {
      title: "방문 확인 반응으로 저장했어요.",
      description: "공개 분포는 서버의 검증된 집계가 갱신된 뒤 반영됩니다.",
    };
  }

  if (moderationStatus === "held") {
    return {
      title: "반응은 저장됐지만 공개 반영을 보류했어요.",
      description: "보류는 자동화나 조작을 확정한다는 뜻이 아닙니다.",
    };
  }

  if (moderationStatus === "rejected") {
    return {
      title: "반응은 내 선택으로 남겼어요.",
      description: "현재 공개 반영 조건을 충족하지 않아 분포에는 포함되지 않습니다.",
    };
  }

  return {
    title: "계정에도 개인 반응으로 저장했어요.",
    description: "방문 확인 전이라 공개 반응에는 포함되지 않습니다.",
  };
}

export function ReactionSelector({
  restaurantId,
  reactionRestaurantId = null,
}: ReactionSelectorProps) {
  const selectedKind = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener(PRIVATE_REACTION_EVENT, onStoreChange);

      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(PRIVATE_REACTION_EVENT, onStoreChange);
      };
    },
    () => readPrivateReaction(window.localStorage, restaurantId),
    () => null,
  );
  const clientRef = useRef<
    Awaited<ReturnType<typeof getBrowserSupabaseClient>>
  >(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [authPending, setAuthPending] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<SaveNotice>({ state: "idle" });
  const [visitState, setVisitState] = useState<VisitState>({ state: "idle" });
  const [pendingKind, setPendingKind] = useState<ReactionKind | null>(null);
  const [serverSelectedKind, setServerSelectedKind] =
    useState<ReactionKind | null>(null);
  const effectiveSelectedKind =
    pendingKind ?? serverSelectedKind ?? selectedKind;
  const isSaving = saveNotice.state === "saving";

  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    void getBrowserSupabaseClient().then(async (client) => {
      if (!isActive) return;

      clientRef.current = client;
      if (!client) {
        setAuthStatus("unavailable");
        return;
      }

      try {
        const { data, error } = await client.auth.getSession();
        if (!isActive) return;

        setAuthStatus(
          error ? "unavailable" : data.session ? "signed_in" : "signed_out",
        );

        const { data: listener } = client.auth.onAuthStateChange(
          (_event, session) => {
            if (isActive) {
              setAuthStatus(session ? "signed_in" : "signed_out");
              if (!session) setVisitState({ state: "idle" });
            }
          },
        );
        unsubscribe = () => listener.subscription.unsubscribe();
      } catch {
        if (isActive) setAuthStatus("unavailable");
      }
    });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  const selectReaction = async (kind: ReactionKind) => {
    if (isSaving) return;

    setPendingKind(kind);
    setSaveNotice({ state: "saving" });

    let localStored = false;

    try {
      savePrivateReaction(window.localStorage, restaurantId, kind);
      localStored = true;
      setServerSelectedKind(null);
      window.dispatchEvent(new Event(PRIVATE_REACTION_EVENT));
    } catch {
      // The authenticated server path can still preserve the user's selection.
    }

    let client = clientRef.current;

    try {
      client ??= await getBrowserSupabaseClient();
      clientRef.current = client;
    } catch {
      client = null;
    }

    if (!client || !reactionRestaurantId) {
      setSaveNotice(
        localStored
          ? { state: "local_only", localStored: true }
          : {
              state: "error",
              message: "이 기기에 저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.",
            },
      );
      setPendingKind(null);
      return;
    }

    let session;
    let sessionFailed = false;

    try {
      const result = await client.auth.getSession();
      session = result.data.session;
      sessionFailed = Boolean(result.error);
    } catch {
      sessionFailed = true;
    }

    if (sessionFailed || !session?.access_token) {
      setAuthStatus(sessionFailed ? "unavailable" : "signed_out");
      setSaveNotice(
        localStored
          ? { state: "local_only", localStored: true }
          : {
              state: "error",
              message: "로그인되지 않았고 이 기기에도 저장하지 못했어요.",
            },
      );
      setPendingKind(null);
      return;
    }

    let visitProofToken: string | undefined;

    if (visitState.state === "ready") {
      visitProofToken = visitState.proof.token;
    }

    try {
      const reaction = await submitAuthenticatedReaction({
        accessToken: session.access_token,
        restaurantId: reactionRestaurantId,
        kind,
        ...(visitProofToken ? { visitProofToken } : {}),
      });

      if (!localStored) setServerSelectedKind(reaction.kind);
      if (visitProofToken && reaction.moderationStatus === "counted") {
        setVisitState({ state: "consumed" });
      }
      setSaveNotice({
        state: "saved",
        localStored,
        moderationStatus: reaction.moderationStatus,
      });
    } catch (submissionError) {
      if (
        submissionError instanceof ReactionSubmissionError &&
        submissionError.status === 401
      ) {
        setAuthStatus("signed_out");
      }

      if (
        submissionError instanceof ReactionSubmissionError &&
        submissionError.status === 409
      ) {
        setVisitState({ state: "error", message: submissionError.message });
      }

      setSaveNotice({
        state: "error",
        message: localStored
          ? submissionError instanceof Error
            ? submissionError.message
            : "서버에 저장하지 못했어요. 내 취향 선택은 이 기기에 남아 있습니다."
          : "이 기기와 서버에 반응을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setPendingKind(null);
    }
  };

  const checkIn = async () => {
    if (visitState.state === "checking" || authStatus !== "signed_in") return;

    if (!reactionRestaurantId) {
      setVisitState({
        state: "error",
        message: "이 식당은 아직 방문 체크인 대상과 연결되지 않았어요.",
      });
      return;
    }

    if (!("geolocation" in navigator)) {
      setVisitState({
        state: "error",
        message: "이 브라우저에서는 위치 확인을 사용할 수 없어요.",
      });
      return;
    }

    setVisitState({ state: "checking" });

    try {
      const client = clientRef.current ?? (await getBrowserSupabaseClient());
      clientRef.current = client;

      if (!client) {
        setVisitState({
          state: "error",
          message: "로그인 설정을 불러오지 못했어요.",
        });
        return;
      }

      const { data, error } = await client.auth.getSession();
      if (error || !data.session?.access_token) {
        setAuthStatus(error ? "unavailable" : "signed_out");
        setVisitState({
          state: "error",
          message: "로그인이 만료됐어요. 다시 로그인해 주세요.",
        });
        return;
      }

      const proof = await requestLocationVisitProof(
        {
          accessToken: data.session.access_token,
          restaurantId: reactionRestaurantId,
        },
        navigator.geolocation,
      );
      setVisitState({ state: "ready", proof });
    } catch (error) {
      if (error instanceof VisitCheckInError && error.kind === "auth_required") {
        setAuthStatus("signed_out");
      }

      setVisitState({
        state: "error",
        message:
          error instanceof VisitCheckInError
            ? error.message
            : "방문 확인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.",
      });
    }
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authPending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setAuthMessage("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setAuthPending(true);
    setAuthMessage(null);

    try {
      const client = clientRef.current ?? (await getBrowserSupabaseClient());
      clientRef.current = client;

      if (!client) {
        setAuthStatus("unavailable");
        setAuthMessage("로그인 설정을 불러오지 못했어요.");
        return;
      }

      const { error } = await client.auth.signInWithPassword({ email, password });

      if (error) {
        setAuthMessage("이메일 또는 비밀번호를 확인해 주세요.");
      } else {
        setAuthStatus("signed_in");
        setAuthMessage("로그인했어요. 반응 버튼을 누르면 계정에도 저장됩니다.");
        form.reset();
      }
    } catch {
      setAuthStatus("unavailable");
      setAuthMessage("로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setAuthPending(false);
    }
  };

  const signOut = async () => {
    if (authPending) return;

    setAuthPending(true);
    setAuthMessage(null);
    try {
      const client = clientRef.current ?? (await getBrowserSupabaseClient());
      clientRef.current = client;

      if (!client) {
        setAuthStatus("unavailable");
        setAuthMessage("로그아웃 설정을 불러오지 못했어요.");
        return;
      }

      const { error } = await client.auth.signOut();
      if (error) {
        setAuthMessage("로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.");
      } else {
        setAuthStatus("signed_out");
        setVisitState({ state: "idle" });
        setAuthMessage("로그아웃했어요. 기존 개인 취향은 이 기기에 남아 있습니다.");
      }
    } catch {
      setAuthMessage("로그아웃 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setAuthPending(false);
    }
  };

  let noticeCopy = {
    title: "지금 선택하면 개인 취향에 먼저 저장돼요.",
    description: "방문 체크인 뒤 선택하면 공개 반응 후보로 검증합니다.",
  };

  if (saveNotice.state === "saving") {
    noticeCopy = {
      title: "반응을 저장하고 있어요.",
      description: "선택한 반응은 먼저 이 기기의 개인 취향으로 보존합니다.",
    };
  } else if (saveNotice.state === "saved") {
    noticeCopy = getSavedNoticeCopy(saveNotice.moderationStatus);
    if (!saveNotice.localStored) {
      noticeCopy = {
        ...noticeCopy,
        description: `${noticeCopy.description} 이 기기 저장은 사용할 수 없습니다.`,
      };
    }
  } else if (saveNotice.state === "error") {
    noticeCopy = {
      title: "반응 저장을 완료하지 못했어요.",
      description: saveNotice.message,
    };
  } else if (saveNotice.state === "local_only" || selectedKind !== null) {
    noticeCopy = {
      title: "내 취향에 저장했어요.",
      description: "로그인·방문 확인 전이라 공개 반응에는 포함되지 않습니다.",
    };
  }

  return (
    <section className="detail-panel reaction-input-panel" aria-labelledby="reaction-input-title">
      <div className="detail-panel-heading">
        <div>
          <p className="eyebrow">내 반응</p>
          <h2 id="reaction-input-title">한 번 탭해서 남겨 보세요</h2>
        </div>
        <span className="private-reaction-badge">
          {authStatus === "signed_in" ? "계정 연결됨" : "이 기기에 먼저 저장"}
        </span>
      </div>

      <div className="reaction-choice-grid" role="group" aria-label="내 반응 선택">
        {REACTIONS.map(({ kind, label, symbol }) => (
          <button
            key={kind}
            type="button"
            className={`reaction-choice reaction-choice-${kind}`}
            aria-pressed={effectiveSelectedKind === kind}
            disabled={isSaving}
            onClick={() => void selectReaction(kind)}
          >
            <span aria-hidden="true">{symbol}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </div>

      <div className="private-reaction-notice" role="status" aria-live="polite">
        <strong>{noticeCopy.title}</strong>
        <span>{noticeCopy.description}</span>
      </div>

      <div className="reaction-auth-panel" aria-labelledby="reaction-auth-title">
        <div>
          <p className="eyebrow">Supabase Auth</p>
          <h3 id="reaction-auth-title">로그인 상태</h3>
        </div>

        {authStatus === "checking" ? (
          <p>로그인 상태를 확인하고 있어요.</p>
        ) : authStatus === "unavailable" ? (
          <p>
            로그인 연결을 사용할 수 없어요. 반응은 계속 이 기기의 개인 취향으로만
            저장할 수 있습니다.
          </p>
        ) : authStatus === "signed_in" ? (
          <div className="reaction-auth-signed-in">
            <p>
              로그인됐어요. 체크인 전 반응은 개인 전용이고, 체크인 뒤 반응은 공개
              조건을 검증합니다.
            </p>
            <button type="button" disabled={authPending} onClick={() => void signOut()}>
              {authPending ? "처리 중…" : "로그아웃"}
            </button>
          </div>
        ) : (
          <form className="reaction-auth-form" onSubmit={(event) => void signIn(event)}>
            <label>
              이메일
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                disabled={authPending}
              />
            </label>
            <label>
              비밀번호
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                disabled={authPending}
              />
            </label>
            <button type="submit" disabled={authPending}>
              {authPending ? "로그인 중…" : "로그인"}
            </button>
            <small>
              로그인만으로 공개 반응이 되지는 않습니다. 위치 체크인 전에는 계정의
              개인 반응으로 저장됩니다.
            </small>
          </form>
        )}

        {authMessage ? (
          <p className="reaction-auth-message" role="status" aria-live="polite">
            {authMessage}
          </p>
        ) : null}
      </div>

      <div className="visit-checkin-panel" aria-labelledby="visit-checkin-title">
        <div>
          <p className="eyebrow">위치 기반 방문 확인</p>
          <h3 id="visit-checkin-title">공개 반응 후보 만들기</h3>
        </div>
        <p>
          버튼을 누를 때만 브라우저가 위치 권한을 요청합니다. 식당과 120m 이내,
          위치 정확도 100m 이하이면 24시간 동안 한 번 쓸 수 있습니다.
        </p>
        <p className="visit-checkin-privacy">
          원본 좌표와 브라우저 위치 응답은 저장하지 않습니다. 위치 확인은 실제 식사를
          보장하지 않습니다.
        </p>
        <button
          type="button"
          disabled={
            authStatus !== "signed_in" ||
            visitState.state === "checking" ||
            isSaving ||
            !reactionRestaurantId
          }
          onClick={() => void checkIn()}
        >
          {visitState.state === "checking"
            ? "위치 확인 중…"
            : authStatus === "signed_in"
              ? "방문 체크인"
              : "로그인 후 체크인"}
        </button>

        <div className="visit-checkin-status" role="status" aria-live="polite">
          {visitState.state === "ready" ? (
            <>
              <strong>방문 확인이 준비됐어요.</strong>
              <span>24시간 안에 반응 버튼을 한 번 누르면 공개 반영을 검증합니다.</span>
            </>
          ) : visitState.state === "consumed" ? (
            <>
              <strong>방문 확인을 반응에 사용했어요.</strong>
              <span>같은 확인은 다시 사용할 수 없습니다.</span>
            </>
          ) : visitState.state === "error" ? (
            <>
              <strong>방문 확인을 완료하지 못했어요.</strong>
              <span>{visitState.message}</span>
            </>
          ) : visitState.state === "checking" ? (
            <>
              <strong>현재 위치를 한 번 확인하고 있어요.</strong>
              <span>브라우저의 위치 권한 선택을 확인해 주세요.</span>
            </>
          ) : (
            <>
              <strong>아직 방문 확인 전이에요.</strong>
              <span>반응은 언제든 개인 취향으로 먼저 저장할 수 있습니다.</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
