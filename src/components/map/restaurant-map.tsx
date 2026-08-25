"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Restaurant } from "@/domain/types";

import { MapFallback } from "./map-fallback";
import type { CreatorVisitSource } from "./map-view-model";

interface RestaurantMapProps {
  restaurants: readonly Restaurant[];
  selectedRestaurantId: string | null;
  creatorVisitSources: readonly CreatorVisitSource[];
  onSelectRestaurant: (restaurantId: string) => void;
}

interface MarkerEntry {
  marker: KakaoMarkerInstance;
  infoWindow: KakaoInfoWindowInstance;
  onClick: () => void;
  isCreatorVisit: boolean;
}

const MAP_LEVEL = 4;

function markerSvg(color: string, centerColor: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46"><path d="M18 1C8.6 1 1 8.6 1 18c0 12.2 17 27 17 27s17-14.8 17-27C35 8.6 27.4 1 18 1Z" fill="${color}" stroke="#ffffff" stroke-width="2"/><circle cx="18" cy="18" r="7" fill="${centerColor}"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createInfoContent(
  restaurant: Restaurant,
  creatorSource: CreatorVisitSource | undefined,
) {
  const root = document.createElement("div");
  root.className = "kakao-info-window";

  const name = document.createElement("strong");
  name.textContent = restaurant.name;
  root.append(name);

  const category = document.createElement("span");
  category.textContent = restaurant.categoryName;
  root.append(category);

  if (creatorSource) {
    const badge = document.createElement("em");
    badge.textContent = "확인된 크리에이터 방문";
    root.append(badge);

    const source = document.createElement("span");
    source.textContent = creatorSource.channelTitle;
    root.append(source);

    const link = document.createElement("a");
    link.href = creatorSource.videoUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "YouTube 원본 보기";
    root.append(link);
  }

  return root;
}

export function RestaurantMap({
  restaurants,
  selectedRestaurantId,
  creatorVisitSources,
  onSelectRestaurant,
}: RestaurantMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const selectedRestaurantIdRef = useRef(selectedRestaurantId);
  const markerEntriesRef = useRef(new Map<string, MarkerEntry>());
  const markerImagesRef = useRef<{
    standard: KakaoMarkerImage;
    creator: KakaoMarkerImage;
    selected: KakaoMarkerImage;
  } | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
  const creatorSourceByRestaurantId = useMemo(() => {
    const sourceByRestaurantId = new Map<string, CreatorVisitSource>();

    for (const source of creatorVisitSources) {
      if (!sourceByRestaurantId.has(source.restaurantId)) {
        sourceByRestaurantId.set(source.restaurantId, source);
      }
    }

    return sourceByRestaurantId;
  }, [creatorVisitSources]);

  const clearMarkers = useCallback(() => {
    const maps = window.kakao?.maps;
    for (const entry of markerEntriesRef.current.values()) {
      entry.infoWindow.close();
      entry.marker.setMap(null);
      maps?.event.removeListener(entry.marker, "click", entry.onClick);
    }
    markerEntriesRef.current.clear();
  }, []);

  const syncSelection = useCallback((restaurantId: string | null) => {
    if (!mapRef.current || !markerImagesRef.current) return;

    for (const [entryRestaurantId, entry] of markerEntriesRef.current) {
      const selected = entryRestaurantId === restaurantId;
      entry.infoWindow.close();
      entry.marker.setZIndex(selected ? 10 : 1);
      entry.marker.setImage(
        selected
          ? markerImagesRef.current.selected
          : entry.isCreatorVisit
            ? markerImagesRef.current.creator
            : markerImagesRef.current.standard,
      );
    }

    if (!restaurantId) return;
    const selectedEntry = markerEntriesRef.current.get(restaurantId);
    if (!selectedEntry) return;

    selectedEntry.infoWindow.open(mapRef.current, selectedEntry.marker);
    mapRef.current.panTo(selectedEntry.marker.getPosition());
  }, []);

  useEffect(() => {
    if (!sdkReady || !containerRef.current || restaurants.length === 0) return;

    const maps = window.kakao?.maps;
    if (!maps) return;

    const animationFrame = window.requestAnimationFrame(() => {
      try {
        clearMarkers();

        const firstRestaurant = restaurants[0];
        const map = new maps.Map(containerRef.current!, {
          center: new maps.LatLng(firstRestaurant.latitude, firstRestaurant.longitude),
          level: MAP_LEVEL,
        });
        const bounds = new maps.LatLngBounds();
        const standardImage = new maps.MarkerImage(
          markerSvg("#087f73", "#ffffff"),
          new maps.Size(36, 46),
        );
        const creatorImage = new maps.MarkerImage(
          markerSvg("#e04f2f", "#fff4d8"),
          new maps.Size(36, 46),
        );
        const selectedImage = new maps.MarkerImage(
          markerSvg("#132f38", "#f3cb53"),
          new maps.Size(36, 46),
        );

        markerImagesRef.current = {
          standard: standardImage,
          creator: creatorImage,
          selected: selectedImage,
        };

        for (const restaurant of restaurants) {
          const position = new maps.LatLng(restaurant.latitude, restaurant.longitude);
          const creatorSource = creatorSourceByRestaurantId.get(restaurant.id);
          const isCreatorVisit = creatorSource !== undefined;
          const marker = new maps.Marker({
            map,
            position,
            title: restaurant.name,
            image: isCreatorVisit ? creatorImage : standardImage,
          });
          const infoWindow = new maps.InfoWindow({
            content: createInfoContent(restaurant, creatorSource),
            removable: false,
          });
          const onClick = () => onSelectRestaurant(restaurant.id);

          maps.event.addListener(marker, "click", onClick);
          markerEntriesRef.current.set(restaurant.id, {
            marker,
            infoWindow,
            onClick,
            isCreatorVisit,
          });
          bounds.extend(position);
        }

        if (restaurants.length > 1) {
          map.setBounds(bounds);
        } else {
          map.setCenter(
            new maps.LatLng(firstRestaurant.latitude, firstRestaurant.longitude),
          );
        }
        mapRef.current = map;
        setMapReady(true);
        syncSelection(selectedRestaurantIdRef.current);
      } catch {
        setLoadError("지도 초기화에 실패했습니다.");
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      clearMarkers();
    };
  }, [
    clearMarkers,
    creatorSourceByRestaurantId,
    onSelectRestaurant,
    restaurants,
    sdkReady,
    syncSelection,
  ]);

  useEffect(() => {
    selectedRestaurantIdRef.current = selectedRestaurantId;
    syncSelection(selectedRestaurantId);
  }, [selectedRestaurantId, syncSelection]);

  useEffect(() => {
    const handleResize = () => mapRef.current?.relayout();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!appKey || mapReady || loadError) return;

    const timeout = window.setTimeout(() => {
      setLoadError("지도 응답 시간이 초과되었습니다.");
    }, 8_000);

    return () => window.clearTimeout(timeout);
  }, [appKey, loadError, mapReady]);

  if (!appKey) {
    return (
      <MapFallback
        reason="지도 키가 설정되지 않았습니다."
        restaurants={restaurants}
        creatorVisitSources={creatorVisitSources}
        selectedRestaurantId={selectedRestaurantId}
        onSelectRestaurant={onSelectRestaurant}
      />
    );
  }

  if (loadError) {
    return (
      <MapFallback
        reason={loadError}
        restaurants={restaurants}
        creatorVisitSources={creatorVisitSources}
        selectedRestaurantId={selectedRestaurantId}
        onSelectRestaurant={onSelectRestaurant}
      />
    );
  }

  return (
    <div className="map-canvas-shell">
      <div
        ref={containerRef}
        className="map-canvas"
        role="region"
        aria-label="성수동 식당 Kakao 지도"
      />
      {!mapReady && (
        <div className="map-loading" role="status">
          Kakao 지도를 불러오는 중입니다.
        </div>
      )}
      <Script
        id="kakao-maps-sdk"
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`}
        strategy="afterInteractive"
        onReady={() => {
          const kakao = window.kakao;
          if (!kakao?.maps) {
            setLoadError("지도 SDK를 사용할 수 없습니다.");
            return;
          }
          kakao.maps.load(() => setSdkReady(true));
        }}
        onError={() => setLoadError("지도 네트워크 연결에 실패했습니다.")}
      />
    </div>
  );
}
