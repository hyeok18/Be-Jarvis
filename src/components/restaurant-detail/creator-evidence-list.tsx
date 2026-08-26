import type { CreatorVisitSource } from "@/components/map/map-view-model";

interface CreatorEvidenceListProps {
  restaurantName: string;
  sources: readonly CreatorVisitSource[];
}

export function CreatorEvidenceList({
  restaurantName,
  sources,
}: CreatorEvidenceListProps) {
  return (
    <section className="detail-panel creator-evidence-panel" aria-labelledby="creator-evidence-title">
      <div className="detail-panel-heading">
        <div>
          <p className="eyebrow">YouTube 방문 근거</p>
          <h2 id="creator-evidence-title">확인된 원본 영상</h2>
        </div>
        <span className="creator-evidence-count">{sources.length}개</span>
      </div>

      {sources.length === 0 ? (
        <p className="detail-empty-state">
          관리자가 방문 장소를 확인하고 최신 상태로 검증한 영상이 아직 없어요.
        </p>
      ) : (
        <ul className="detail-creator-list" aria-label={`${restaurantName} 확인된 YouTube 방문 근거`}>
          {sources.map((source) => (
            <li key={source.videoId}>
              <a href={source.videoUrl} target="_blank" rel="noopener noreferrer">
                <span>{source.channelTitle}</span>
                <strong>{source.videoTitle}</strong>
                <small>
                  {source.hiddenSubscriberCount
                    ? "구독자 수 비공개"
                    : source.subscriberCountState === "stale"
                      ? "구독자 수 업데이트 필요"
                      : source.subscriberCountState === "unavailable"
                        ? "구독자 수 확인 불가"
                        : source.subscriberCount === null
                          ? "구독자 수 확인 중"
                          : `구독자 ${source.subscriberCount.toLocaleString("ko-KR")}명`}
                  {` · 영상 ${source.publishedAt.slice(0, 10)}`}
                  {` · API 기준 ${source.metadataFetchedAt.slice(0, 10)}`}
                </small>
                <b>원본 영상 열기 ↗</b>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="detail-disclaimer">
        구독자 수는 YouTube API의 최신 원값인 인기도 참고 정보입니다. 방문 사실 외에
        식당 품질, 협찬 여부, 영상 내용의 정확성을 보장하지 않습니다.
      </p>
    </section>
  );
}

