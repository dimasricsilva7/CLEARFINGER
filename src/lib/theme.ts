/** Converte cores do admin (hex) em tokens CSS (canais RGB). Valores inválidos são ignorados. */
export function hexToChannels(hex: string | undefined): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function themeCss(settings: Record<string, string>): string {
  const map: [string, string][] = [
    ["primary", settings.theme_primary],
    ["navy", settings.theme_navy],
    ["bg", settings.theme_background],
  ];
  const vars = map.map(([k, v]) => [k, hexToChannels(v)] as const).filter(([, v]) => v);
  return vars.length ? `:root{${vars.map(([k, v]) => `--c-${k}:${v}`).join(";")}}` : "";
}
