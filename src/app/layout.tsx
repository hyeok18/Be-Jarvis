import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "맛집 리뷰 신뢰도 지도",
  description: "맛 점수와 리뷰 신뢰도를 근거와 함께 보여주는 성수동 맛집 랭킹",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
