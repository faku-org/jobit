/**
 * Lo mínimo que el servidor MCP necesita saber de la respuesta de la API.
 *
 * Son tipos propios y no los de `api/src/types.ts`: el MCP es un proceso
 * aparte que habla con la API por HTTP, así que no importa su código. Copiar
 * la forma es lo que deja apuntar a producción o a un self-host sin arrastrar
 * el workspace de la API.
 */

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string;
}

export interface Job {
  id: string;
  source: string;
  source_id: string;
  title: string;
  company: string | null;
  department: string | null;
  city: string | null;
  category: string;
  category_label: string;
  date_posted: string;
  level: "entry" | "mid" | "senior" | null;
  remote: "remote" | "hybrid" | null;
  job_type: "full_time" | "part_time" | "internship" | null;
  salary: Salary | null;
  experience_years_min: number | null;
  no_experience: boolean;
  closes_at: string | null;
  description: string;
  requirements: string | null;
  apply_url: string;
}

export interface JobsResponse {
  total: number;
  offset: number;
  limit: number;
  jobs: Job[];
}

export interface Facet {
  value: string;
  label: string;
  count: number;
}

export interface Meta {
  count: number;
  scraped_at: string;
  sources: string[];
  categories: Facet[];
  departments: Facet[];
  no_experience_count: number;
}
