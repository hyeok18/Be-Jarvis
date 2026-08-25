"use client";

import { useEffect, useRef, useState } from "react";

type KakaoMapProps = { className?: string };
const SDK_ID = "kakao-maps-sdk";

export function KakaoMap({ className = "" }: KakaoMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
    if (!appKey || !mapElement.current) { setStatus("fallback"); return; }
    const initialize = () => {
      if (!window.kakao?.maps || !mapElement.current) { setStatus("fallback"); return; }
      window.kakao.maps.load(() => {
        if (!window.kakao?.maps || !mapElement.current) return;
        const center = new window.kakao.maps.LatLng(37.5446, 127.0559);
        const map = new window.kakao.maps.Map(mapElement.current, { center, level: 4 });
        map.relayout();
        setStatus("ready");
      });
    };
    const existing = document.getElementById(SDK_ID);
    if (existing) { initialize(); return; }
    const script = document.createElement("script");
    script.id = SDK_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.onload = initialize;
    script.onerror = () => setStatus("fallback");
    document.head.appendChild(script);
    const timeout = window.setTimeout(() => setStatus((current) => current === "loading" ? "fallback" : current), 8000);
    return () => window.clearTimeout(timeout);
  }, []);

  return <div aria-label={status === "ready" ? "카카오 지도" : "지도 미리보기"} className={`kakao-map-layer ${className}`} ref={mapElement}>{status === "fallback" && <span className="kakao-map-fallback">지도를 불러오지 못해 미리보기로 보여드려요</span>}</div>;
}
