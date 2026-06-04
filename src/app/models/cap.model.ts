export type CapType = 'crown' | 'pet' | 'screw';

export interface Cap {
  id: string;
  type: CapType;
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
  createdAt?: number;
}

export type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'country';

export interface CapFilters {
  type: CapType;
  search: string;
  country: string;
  tag: string;
  color: string;
  forTrade: boolean | null;
  sort: SortOption;
}

export function createDefaultFilters(): CapFilters {
  return {
    type: 'crown',
    search: '',
    country: '',
    tag: '',
    color: '',
    forTrade: null,
    sort: 'newest',
  };
}

export interface PaginatedCapsResult {
  caps: Cap[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface TypeCollectionMeta {
  total: number;
  forTrade: number;
  countries: string[];
  tags: string[];
  countryCounts: Record<string, number>;
}

export type CollectionMeta = Record<CapType, TypeCollectionMeta>;
