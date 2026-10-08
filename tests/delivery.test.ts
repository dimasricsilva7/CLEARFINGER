import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSchedule, dueStages, formatTrackingDate, localYmd, nextBusinessDay, parseHolidays, stageDefs, zonedTime } from "../src/lib/delivery";

const sp = (d: Date) => formatTrackingDate(d); // dd/mm/aaaa às hh:mm em São Paulo

test("entrega: horário de São Paulo e dias úteis", () => {
  assert.equal(zonedTime("2026-10-08", 10, 30).toISOString(), "2026-10-08T13:30:00.000Z");
  assert.equal(localYmd(new Date("2026-10-09T02:00:00Z")), "2026-10-08"); // 23:00 em SP ainda é dia 08
  assert.equal(nextBusinessDay("2026-10-08"), "2026-10-09"); // qui → sex
  assert.equal(nextBusinessDay("2026-10-09"), "2026-10-12"); // sex → seg
  assert.equal(nextBusinessDay("2026-10-10"), "2026-10-12"); // sáb → seg
  assert.equal(nextBusinessDay("2026-10-11"), "2026-10-12"); // dom → seg
  assert.equal(nextBusinessDay("2026-10-09", parseHolidays("2026-10-12")), "2026-10-13"); // feriado configurado
});

test("entrega: pagamento numa quinta gera S2..S6 nos dias úteis seguintes", () => {
  const paid = new Date("2026-10-08T17:12:00Z"); // qui 14:12 SP
  const s = computeSchedule(paid);
  assert.deepEqual(s.map((x) => x.code), ["PAID", "SEPARATING", "DC_ARRIVED", "DISPATCHED", "DEST_DC_ARRIVED", "OUT_FOR_DELIVERY"]);
  assert.deepEqual(s.map((x) => sp(x.at)), [
    "08/10/2026 às 14:12",
    "09/10/2026 às 10:30",
    "09/10/2026 às 16:30",
    "12/10/2026 às 09:30", // fim de semana pulado
    "12/10/2026 às 16:30",
    "13/10/2026 às 10:30",
  ]);
  assert.equal(s[1].description, "Seu pedido foi confirmado e está sendo preparado para envio.");
});

test("entrega: pagamento no sábado à noite começa na segunda", () => {
  const s = computeSchedule(new Date("2026-10-11T01:30:00Z")); // sáb 22:30 SP
  assert.equal(sp(s[1].at), "12/10/2026 às 10:30");
  assert.equal(sp(s[5].at), "14/10/2026 às 10:30");
});

test("entrega: só etapas vencidas aparecem; textos editáveis", () => {
  const paid = new Date("2026-10-08T17:12:00Z");
  assert.equal(dueStages(paid, new Date("2026-10-08T20:00:00Z")).length, 1);
  assert.equal(dueStages(paid, new Date("2026-10-09T14:00:00Z")).length, 2);
  assert.equal(dueStages(paid, new Date("2026-10-30T00:00:00Z")).length, 6); // "Entregue" nunca é automático
  assert.equal(stageDefs({ tracking_separating_title: "Em separação" })[1].title, "Em separação");
});
