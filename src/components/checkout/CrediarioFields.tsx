"use client";

import { installmentOptions, maskValidity, onlyDigits, type CrediarioConfig } from "@/lib/crediario";

export type CrediarioValue = { protocol: string; validity: string; cpfLast3: string; installments: number };
export const EMPTY_CREDIARIO: CrediarioValue = { protocol: "", validity: "", cpfLast3: "", installments: 1 };

/**
 * Campos do CREDIÁRIO (protocolo — não é cartão). Todos os títulos, placeholders,
 * quantidades de dígitos, formato da validade e textos vêm do admin.
 * Usado no checkout e na prévia em Admin → Pagamentos → Crediário.
 */
export function CrediarioFields({
  cfg,
  totalCents,
  value,
  onChange,
  errors = {},
  preview = false,
}: {
  cfg: CrediarioConfig;
  totalCents: number;
  value: CrediarioValue;
  onChange: (v: CrediarioValue, field: keyof CrediarioValue) => void;
  errors?: Record<string, string>;
  preview?: boolean;
}) {
  const opts = installmentOptions(totalCents, cfg);
  const set = (k: keyof CrediarioValue, v: string | number) => onChange({ ...value, [k]: v }, k);
  const inv = (k: string) => (errors[k] ? { "aria-invalid": true as const, "aria-describedby": `cred-${k}-error` } : {});
  const err = (k: string) => errors[k] && <p id={`cred-${k}-error`} className="mt-1 text-sm font-semibold text-danger">{errors[k]}</p>;

  return (
    <div className="space-y-4">
      {(cfg.sectionTitle || cfg.description) && (
        <div>
          {cfg.sectionTitle && <p className="font-display text-base font-semibold text-navy">{cfg.sectionTitle}</p>}
          {cfg.description && <p className="mt-1 text-sm text-muted">{cfg.description}</p>}
        </div>
      )}
      <div>
        <label htmlFor="cred-protocol" className="label">{cfg.protocolLabel}</label>
        <input
          id="cred-protocol"
          value={value.protocol}
          onChange={(e) => set("protocol", onlyDigits(e.target.value).slice(0, cfg.protocolDigits))}
          inputMode="numeric"
          autoComplete="off"
          placeholder={cfg.protocolPlaceholder}
          className="input tabular-nums tracking-wider placeholder:text-[15px] placeholder:tracking-normal"
          readOnly={preview}
          {...inv("protocol")}
        />
        <p className="mt-1 flex justify-between gap-2 text-xs text-muted">
          <span>{cfg.protocolHelp}</span>
          <span className="tabular-nums">{value.protocol.length}/{cfg.protocolDigits}</span>
        </p>
        {err("protocol")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cred-validity" className="label">{cfg.validityLabel}</label>
          <input
            id="cred-validity"
            value={value.validity}
            onChange={(e) => set("validity", maskValidity(e.target.value, cfg.validityFormat))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={cfg.validityFormat.length}
            placeholder={cfg.validityPlaceholder}
            className="input tabular-nums"
            readOnly={preview}
            {...inv("validity")}
          />
          {err("validity")}
        </div>
        <div>
          <label htmlFor="cred-cpf" className="label">{cfg.cpfLabel}</label>
          <input
            id="cred-cpf"
            value={value.cpfLast3}
            onChange={(e) => set("cpfLast3", onlyDigits(e.target.value).slice(0, cfg.cpfDigits))}
            inputMode="numeric"
            autoComplete="off"
            placeholder={cfg.cpfPlaceholder}
            className="input tabular-nums"
            readOnly={preview}
            {...inv("cpfLast3")}
          />
          {err("cpfLast3")}
        </div>
      </div>
      <fieldset>
        <legend className="label">{cfg.installmentsLabel}</legend>
        {cfg.installmentsDescription && <p className="-mt-1 mb-2 text-sm text-muted">{cfg.installmentsDescription}</p>}
        <div className="grid gap-2">
          {opts.map((o) => (
            <label key={o.n} className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 ${value.installments === o.n ? "border-primary bg-primary/[0.05]" : "border-line bg-surface"}`}>
              <input type="radio" name="cred-installments" checked={value.installments === o.n} onChange={() => set("installments", o.n)} className="h-5 w-5 accent-[rgb(var(--c-primary))]" />
              <span className="font-semibold text-navy">{o.label}</span>
            </label>
          ))}
        </div>
        {err("installments")}
      </fieldset>
      {cfg.helpText && <p className="text-sm text-muted">{cfg.helpText}</p>}
      {cfg.infoMessage && <p className="rounded-xl bg-mist/70 px-4 py-3 text-sm text-navy">{cfg.infoMessage}</p>}
      {cfg.securityText && (
        <p className="flex items-start gap-2 text-xs text-muted">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 10.5h12v10H6zM8.5 10.5V7.5a3.5 3.5 0 017 0v3" /></svg>
          {cfg.securityText}
        </p>
      )}
    </div>
  );
}
