interface CreatorLayerToggleProps {
  active: boolean;
  count: number;
  onToggle: () => void;
}

export function CreatorLayerToggle({
  active,
  count,
  onToggle,
}: CreatorLayerToggleProps) {
  return (
    <button
      type="button"
      className="creator-layer-toggle"
      aria-pressed={active}
      onClick={onToggle}
    >
      <span aria-hidden="true">▶</span>
      크리에이터 방문 {count}곳
      <span className="toggle-state">{active ? "켜짐" : "전체 보기"}</span>
    </button>
  );
}
