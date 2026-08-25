declare global {
type KakaoLatLng = object;

interface KakaoLatLngBounds {
  extend(position: KakaoLatLng): void;
}

interface KakaoMapInstance {
  panTo(position: KakaoLatLng): void;
  relayout(): void;
  setBounds(bounds: KakaoLatLngBounds): void;
  setCenter(position: KakaoLatLng): void;
}

type KakaoMarkerImage = object;

interface KakaoMarkerInstance {
  getPosition(): KakaoLatLng;
  setImage(image: KakaoMarkerImage): void;
  setMap(map: KakaoMapInstance | null): void;
  setZIndex(zIndex: number): void;
}

interface KakaoInfoWindowInstance {
  close(): void;
  open(map: KakaoMapInstance, marker: KakaoMarkerInstance): void;
}

interface KakaoMapsNamespace {
  load(callback: () => void): void;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMapInstance;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Size: new (width: number, height: number) => object;
  MarkerImage: new (src: string, size: object) => KakaoMarkerImage;
  Marker: new (options: {
    position: KakaoLatLng;
    map?: KakaoMapInstance;
    image?: KakaoMarkerImage;
    title?: string;
  }) => KakaoMarkerInstance;
  InfoWindow: new (options: {
    content: string | HTMLElement;
    removable?: boolean;
  }) => KakaoInfoWindowInstance;
  event: {
    addListener(
      target: KakaoMarkerInstance,
      type: "click",
      handler: () => void,
    ): void;
    removeListener(
      target: KakaoMarkerInstance,
      type: "click",
      handler: () => void,
    ): void;
  };
}

interface Window {
  kakao?: {
    maps: KakaoMapsNamespace;
  };
}
}

export {};
