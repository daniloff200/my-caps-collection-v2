export interface Cap {
  id: string;
  name: string;
  country: string;
  manufacturer: string;
  tags: string[];
  imageUrl?: string;
  description?: string;
  forTrade: boolean;
  dateAdded: string;
}

export type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'country';

export interface CapFilters {
  search: string;
  country: string;
  tag: string;
  forTrade: boolean | null;
  sort: SortOption;
}

export function createDefaultFilters(): CapFilters {
  return {
    search: '',
    country: '',
    tag: '',
    forTrade: null,
    sort: 'newest',
  };
}
