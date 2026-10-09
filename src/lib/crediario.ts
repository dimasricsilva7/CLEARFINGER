/**
 * CREDIÁRIO — método próprio baseado em protocolo (NÃO é cartão de crédito).
 * Regras puras, compartilhadas pelo checkout (navegador), pela API (servidor),
 * pela prévia do admin e pelos testes. Todos os textos vêm das configurações.
 */

export const VALIDITY_FORMATS = ["MM/AA", "MM/AAAA", "DD/MM/AA", "DD/MM/AAAA"] as const;
export type ValidityFormat = (typeof VALIDITY_FORMATS)[number];

export type CrediarioConfig = {
  enabled: boolean;
  methodLabel: string;
  /** Linha abaixo do nome do método no checkout ({parcelas} = máximo de parcelas) */
  methodSubtitle: string;
  sectionTitle: string;
  description: string;
  protocolLabel: string;
  protocolPlaceholder: string;
  protocolDigits: number;
  protocolHelp: string;
  protocolError: string;
  validityLabel: string;
  validityPlaceholder: string;
  validityFormat: ValidityFormat;
  validityError: string;
  validityExpiredError: string;
  rejectExpired: boolean;
  cpfLabel: string;
  cpfPlaceholder: string;
  cpfDigits: number;
  cpfError: string;
  installmentsLabel: string;
  installmentsDescription: string;
  maxInstallments: number;
  installmentText: string;
  helpText: string;
  errorMessage: string;
  successTitle: string;
  successMessage: string;
  infoMessage: string;
  buttonLabel: string;
  securityText: string;
};

const clampInt = (v: string | undefined, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function crediarioConfig(s: Record<string, string>): CrediarioConfig {
  const fmt = (VALIDITY_FORMATS as readonly string[]).includes(s.crediario_validity_format) ? (s.crediario_validity_format as ValidityFormat) : "MM/AA";
  const protocolDigits = clampInt(s.crediario_protocol_digits, 4, 32, 16);
  const cpfDigits = clampInt(s.crediario_cpf_digits, 1, 11, 3);
  const fill = (t: string | undefined, n: number) => (t ?? "").replaceAll("{n}", String(n)).replaceAll("{formato}", fmt);
  return {
    enabled: s.crediario_enabled === "true",
    methodLabel: s.crediario_method_label || "Crediário",
    methodSubtitle: (s.crediario_method_subtitle ?? "").replaceAll("{parcelas}", String(clampInt(s.crediario_max_installments, 1, 24, 2))),
    sectionTitle: s.crediario_section_title ?? "",
    description: s.crediario_description ?? "",
    protocolLabel: s.crediario_protocol_label || "Número do protocolo",
    protocolPlaceholder: s.crediario_protocol_placeholder ?? "",
    protocolDigits,
    protocolHelp: s.crediario_protocol_help ?? "",
    protocolError: fill(s.crediario_protocol_error || "Informe os {n} dígitos do protocolo.", protocolDigits),
    validityLabel: s.crediario_validity_label || "Validade",
    validityPlaceholder: s.crediario_validity_placeholder || fmt,
    validityFormat: fmt,
    validityError: fill(s.crediario_validity_error || "Informe a validade no formato {formato}.", 0),
    validityExpiredError: s.crediario_validity_expired_error || "Protocolo vencido.",
    rejectExpired: s.crediario_validity_reject_expired !== "false",
    cpfLabel: s.crediario_cpf_label || "Últimos dígitos do CPF",
    cpfPlaceholder: s.crediario_cpf_placeholder ?? "",
    cpfDigits,
    cpfError: fill(s.crediario_cpf_error || "Informe os {n} últimos dígitos do CPF.", cpfDigits),
    installmentsLabel: s.crediario_installments_label || "Parcelamento",
    installmentsDescription: s.crediario_installments_description ?? "",
    maxInstallments: clampInt(s.crediario_max_installments, 1, 24, 2),
    installmentText: s.crediario_installment_text || "{n}x de {valor}",
    helpText: s.crediario_help_text ?? "",
    errorMessage: s.crediario_error_message || "Não foi possível registrar o pedido.",
    successTitle: s.crediario_success_title || "Pedido recebido!",
    successMessage: s.crediario_success_message ?? "",
    infoMessage: s.crediario_info_message ?? "",
    buttonLabel: s.crediario_button_label || "Confirmar pedido",
    securityText: s.crediario_security_text ?? "",
  };
}

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** Máscara da validade conforme o formato configurado (ex.: "1228" → "12/28"). */
export function maskValidity(raw: string, format: ValidityFormat): string {
  const pattern = format.replace(/[A-Z]/g, "9"); // "99/99"
  const digits = onlyDigits(raw).slice(0, pattern.replace(/\D/g, "").length);
  let out = "";
  let i = 0;
  for (const ch of pattern) {
    if (i >= digits.length) break;
    if (ch === "9") out += digits[i++];
    else out += ch;
  }
  return out;
}

/** Valida a validade no formato configurado. Retorna o último instante válido ou null se inválida. */
export function parseValidity(value: string, format: ValidityFormat): Date | null {
  const re = new RegExp(`^${format.replace(/DD|MM/g, "(\\d{2})").replace("AAAA", "(\\d{4})").replace("AA", "(\\d{2})").replace(/\//g, "\\/")}$`);
  const m = re.exec(value.trim());
  if (!m) return null;
  const parts = format.split("/");
  const get = (k: string) => m[parts.indexOf(parts.find((p) => p.startsWith(k))!) + 1];
  const month = Number(get("M"));
  const yRaw = get("A");
  const year = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  if (format.startsWith("DD")) {
    const day = Number(get("D"));
    const d = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
    if (d.getUTCMonth() !== month - 1) return null;
    return d;
  }
  return new Date(Date.UTC(year, month, 0, 23, 59, 59)); // último dia do mês
}

export type CrediarioInput = { protocol: string; validity: string; cpfLast3: string; installments: number };

/** Validação (mesma regra no navegador e no servidor). Retorna erros por campo. */
export function validateCrediario(input: CrediarioInput, cfg: CrediarioConfig, now = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!new RegExp(`^\\d{${cfg.protocolDigits}}$`).test(input.protocol ?? "")) errors.protocol = cfg.protocolError;
  const validity = parseValidity(input.validity ?? "", cfg.validityFormat);
  if (!validity) errors.validity = cfg.validityError;
  else if (cfg.rejectExpired && validity.getTime() < now.getTime()) errors.validity = cfg.validityExpiredError;
  if (!new RegExp(`^\\d{${cfg.cpfDigits}}$`).test(input.cpfLast3 ?? "")) errors.cpfLast3 = cfg.cpfError;
  if (!Number.isInteger(input.installments) || input.installments < 1 || input.installments > cfg.maxInstallments) errors.installments = "Escolha o número de parcelas.";
  return errors;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (c: number) => brl.format(c / 100).replace(/ /g, " ");

/** Valor da parcela (arredondado para cima no centavo — nunca cobra menos que o total). */
export const installmentCents = (totalCents: number, n: number) => Math.ceil(totalCents / Math.max(1, n));

export function installmentOptions(totalCents: number, cfg: Pick<CrediarioConfig, "maxInstallments" | "installmentText">) {
  return Array.from({ length: cfg.maxInstallments }, (_, i) => {
    const n = i + 1;
    const cents = installmentCents(totalCents, n);
    return { n, cents, label: cfg.installmentText.replaceAll("{n}", String(n)).replaceAll("{valor}", money(cents)).replaceAll("{total}", money(totalCents)) };
  });
}

/** CPF mascarado para o admin: ***123 */
export const maskCpfLast = (digits: string) => `***${digits}`;

/** "1234567812345678" → "1234 5678 1234 5678" (exibição no admin). */
export const formatProtocol = (p: string) => p.replace(/(\d{4})(?=\d)/g, "$1 ");
