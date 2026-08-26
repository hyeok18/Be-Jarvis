import Link from "next/link";

interface PublicDataUnavailableProps {
  retryHref: string;
  snapshotHref: string;
}

export function PublicDataUnavailable({
  retryHref,
  snapshotHref,
}: PublicDataUnavailableProps) {
  return (
    <main className="restaurant-detail-page" role="alert">
      <p className="eyebrow">공개 데이터 연결 · PUBLIC_DATA_UNAVAILABLE</p>
      <h1>식당 데이터를 잠시 불러올 수 없습니다.</h1>
      <p>
        반응을 0건으로 바꾸거나 임의 데이터로 대체하지 않았습니다. 잠시 후 다시
        시도하거나 발표 백업 모드를 사용해 주세요.
      </p>
      <p>
        <Link href={retryHref}>다시 시도</Link>{" · "}
        <Link href={snapshotHref}>발표 백업 모드로 보기</Link>
      </p>
    </main>
  );
}
