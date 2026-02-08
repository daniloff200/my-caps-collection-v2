declare module 'world-atlas/countries-110m.json' {
  const data: {
    type: string;
    objects: {
      countries: {
        type: string;
        geometries: Array<{
          type: string;
          id: string;
          arcs: any[];
          properties: { name: string };
        }>;
      };
      land: any;
    };
    arcs: any[];
    bbox: number[];
    transform: any;
  };
  export default data;
}
