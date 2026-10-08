import type { IconItem, ProductSpec } from "@/lib/domain";

export type PublicImage = { url: string; alt: string; role: "MAIN" | "SECONDARY" | "GALLERY" };

export type PublicOffer = {
  id: string;
  slug: string;
  name: string;
  quantity: number;
  priceCents: number;
  compareAtPriceCents: number | null;
  discountLabel: string | null;
  badge: string | null;
  highlight: boolean;
  description: string | null;
  imageUrl: string | null;
  unitPriceCents: number;
};

export type PublicProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  shortName: string | null;
  shortDescription: string | null;
  description: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  badge: string | null;
  videoUrl: string | null;
  benefits: IconItem[];
  specs: ProductSpec[];
  mainImage: PublicImage | null;
  secondaryImage: PublicImage | null;
  gallery: PublicImage[];
  offers: PublicOffer[];
};

export type PublicBump = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  priceCents: number;
  compareAtPriceCents: number | null;
  imageUrl: string | null;
  badge: string | null;
  productName: string;
};
