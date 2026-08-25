import Link from "next/link";

interface PublicDataUnavailableProps {
  retryHref: string;
}

export function PublicDataUnavailable({ retryHref }: PublicDataUnavailableProps) {
  return (
    <main className="state-shell" role="alert">
      <p className="eyebrow">공개 데이터 연결</p>
      <h1>식당 데이터를 잠시 불러올 수 없습니다.</h1>
      <p>
        반응을 0건으로 바꾸거나 이전 화면을 임의 데이터로 대체하지 않았습니다. 잠시 후
        다시 시도해 주세요.
      </p>
      <Link href={retryHref}>다시 시도</Link>
    </main>
  );
}
