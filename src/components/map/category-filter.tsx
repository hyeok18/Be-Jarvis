import { toggleCategorySelection } from "./map-view-model";

interface CategoryFilterProps {
  categories: readonly string[];
  selectedCategory: string;
  onSelect: (category: string) => void;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelect,
}: CategoryFilterProps) {
  return (
    <div className="category-filter" aria-label="음식 카테고리 필터">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className="filter-chip"
          aria-pressed={category === selectedCategory}
          onClick={() =>
            onSelect(toggleCategorySelection(selectedCategory, category))
          }
        >
          {category}
        </button>
      ))}
    </div>
  );
}
