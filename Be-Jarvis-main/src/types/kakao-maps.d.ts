declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMapInstance;
        LatLng: new (latitude: number, longitude: number) => unknown;
      };
    };
  }
}

interface KakaoMapInstance {
  addControl: (control: unknown, position: unknown) => void;
  relayout: () => void;
}

export {};
