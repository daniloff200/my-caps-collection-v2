export interface Cap {
  id: string;
  name: string;
  country: string;
  manufacturer: string;
  tags: string[];
  colors: string[];
  imageUrl?: string;
  description?: string;
  forTrade: boolean;
  needsReplacement: boolean;
  cciUrl?: string;
  dateAdded: string;
  createdAt?: number; // Unix timestamp in ms for precise sorting
}

export type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'country';

export interface CapFilters {
  search: string;
  country: string;
  tag: string;
  color: string;
  forTrade: boolean | null;
  sort: SortOption;
}

export function createDefaultFilters(): CapFilters {
  return {
    search: '',
    country: '',
    tag: '',
    color: '',
    forTrade: null,
    sort: 'newest',
  };
}
