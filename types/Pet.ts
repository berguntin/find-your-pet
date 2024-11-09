export type status = "all" | "lost" | "found";

export interface Pet {
  id: string;
  type: string;
  images: string[] | string;
  description: string;
  name: string;
  status: status;
  location: string;
  alive: boolean;
  contact: string;
  date: string;
  athome: boolean;
  created_by: string;
  created_at: string;
}
