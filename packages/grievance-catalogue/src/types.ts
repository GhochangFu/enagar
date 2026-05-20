export type LocalizedName = {
  en: string;
  bn?: string;
  hi?: string;
};

export type GrievanceCatalogueSubtype = {
  code: string;
  name: LocalizedName;
  sort_order: number;
};

export type GrievanceCatalogueCategory = {
  code: string;
  name: LocalizedName;
  icon: string | null;
  global_category_code: string | null;
  sort_order: number;
  subtypes: GrievanceCatalogueSubtype[];
};

export type GrievanceCatalogueResponse = {
  tenant_code: string;
  categories: GrievanceCatalogueCategory[];
};
