export interface CapColor {
  id: string;
  hex: string;
  border?: string;
}

export const CAP_COLORS: CapColor[] = [
  { id: 'red', hex: '#e53e3e' },
  { id: 'orange', hex: '#ed8936' },
  { id: 'yellow', hex: '#ecc94b' },
  { id: 'gold', hex: '#d4a017' },
  { id: 'green', hex: '#38a169' },
  { id: 'blue', hex: '#3182ce' },
  { id: 'purple', hex: '#805ad5' },
  { id: 'pink', hex: '#ed64a6' },
  { id: 'brown', hex: '#8b5e3c' },
  { id: 'black', hex: '#1a1a2e', border: '#4a5568' },
  { id: 'white', hex: '#f7fafc' },
  { id: 'silver', hex: '#a0aec0' },
];
