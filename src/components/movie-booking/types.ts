export type Movie = {
  id: string;
  title: string;
  meta: string;
  genre: string;
  rating: string;
  duration: string;
  poster: string;
  synopsis: string;
};

export type Seat = {
  id: string;
  label: string;
  row: string;
  number: number;
  section: "RECLINER" | "PRIME" | "CLASSIC";
  price: number;
  status: "available" | "sold";
  inventoryId?: string;
};
