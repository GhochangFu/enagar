export type LocalizedName = {
  en: string;
  bn?: string;
  hi?: string;
};

export type GrievanceCatalogueSubtypeDto = {
  code: string;
  name: LocalizedName;
  sort_order: number;
};

export type GrievanceCatalogueCategoryDto = {
  code: string;
  name: LocalizedName;
  icon: string | null;
  global_category_code: string | null;
  sort_order: number;
  subtypes: GrievanceCatalogueSubtypeDto[];
};

export type GrievanceCatalogueResponse = {
  tenant_code: string;
  categories: GrievanceCatalogueCategoryDto[];
};
