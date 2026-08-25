import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "반응과 크리에이터 근거로 보는 맛집 지도",
  description: "세 반응, 나와의 매칭, 맛집 탐방 영상 근거를 함께 보는 성수동 지도",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
