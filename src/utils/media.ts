export const MEDIA_CATEGORIES = ["MARCA", "PRODUTO", "HERO", "DEMONSTRACAO", "BENEFICIOS", "DEPOIMENTOS", "OFERTAS", "OUTROS"] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<string, string> = {
  MARCA: "Marca (logo, favicon)",
  PRODUTO: "Produto",
  HERO: "Primeira tela",
  DEMONSTRACAO: "Demonstração / antes e depois",
  BENEFICIOS: "Benefícios",
  DEPOIMENTOS: "Depoimentos",
  OFERTAS: "Ofertas",
  OUTROS: "Outros",
};

export const isMediaCategory = (v: unknown): v is MediaCategory => typeof v === "string" && (MEDIA_CATEGORIES as readonly string[]).includes(v);
