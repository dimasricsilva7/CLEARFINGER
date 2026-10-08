export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits).replace(".", ",")}%`;
export const int = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));
export const ratioLabel = (v: number | null) => (v == null ? "—" : `${v.toFixed(2).replace(".", ",")}x`);
