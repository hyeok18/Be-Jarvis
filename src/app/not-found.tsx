import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-shell">
      <p className="eyebrow">404</p>
      <h1>요청한 페이지를 찾을 수 없습니다.</h1>
      <Link href="/">랭킹 홈으로 돌아가기</Link>
    </main>
  );
}
