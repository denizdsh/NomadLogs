import { SearchBar } from "~/components/ui/SearchBar";
import { Tag } from "~/components/ui/Tag";
import { Select, type SelectOption } from "~/components/ui/Select";

export interface ContentFiltersProps {
  activeTypes: string[];
  contentTypes: { key: string; label: string }[];
  onTypeToggle: (key: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  sortOptions?: SelectOption[];
  className?: string;
  searchPlaceholder?: string;
}

export function ContentFilters({
  activeTypes,
  contentTypes,
  onTypeToggle,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  sortOptions = [
    { value: "latest", label: "Latest" },
    { value: "popular", label: "Popular" },
    { value: "saved", label: "Most Saved" },
  ],
  className = "",
  searchPlaceholder = "Search...",
}: ContentFiltersProps) {
  return (
    <section className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      <nav className="flex flex-wrap items-center gap-2" aria-label="Filters">
        {contentTypes.map((type) => (
          <Tag
            key={type.key}
            label={type.label}
            variant="content-type"
            isActive={activeTypes.includes(type.key)}
            onToggle={() => onTypeToggle(type.key)}
          />
        ))}
      </nav>

      <section className="flex items-center gap-3 w-full sm:w-auto">
        <SearchBar
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={onSearchChange}
          size="sm"
          className="w-full sm:w-64"
        />
        <Select
          value={sortBy}
          onChange={onSortChange}
          options={sortOptions}
          className="w-full sm:w-auto min-w-[130px]"
        />
      </section>
    </section>
  );
}
