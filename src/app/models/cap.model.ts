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

export interface CapFilters {
  search: string;
  country: string;
  tag: string;
  forTrade: boolean | null;
}

export function createDefaultFilters(): CapFilters {
  return {
    search: '',
    country: '',
    tag: '',
    forTrade: null,
  };
}
