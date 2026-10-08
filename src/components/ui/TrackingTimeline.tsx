import { formatTrackingDate } from "@/lib/delivery";
import type { PublicTrackingEvent } from "@/types/order";

/** Linha do tempo vertical (mobile first): etapas concluídas com data, próximas etapas esmaecidas. */
export function TrackingTimeline({ events }: { events: PublicTrackingEvent[] }) {
  const lastDone = events.reduce((acc, e, i) => (e.done ? i : acc), -1);
  return (
    <ol className="relative">
      {events.map((e, i) => {
        const current = i === lastDone;
        const isLast = i === events.length - 1;
        return (
          <li key={`${e.status}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && <span aria-hidden="true" className={`absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 ${e.done && i < lastDone ? "bg-success" : "bg-line"}`} />}
            <span
              aria-hidden="true"
              className={`relative z-[1] mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                current ? "bg-success text-white ring-4 ring-success/20" : e.done ? "bg-success text-white" : "border-2 border-line bg-surface"
              }`}
            >
              {e.done && (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] font-semibold leading-snug ${e.done ? "text-navy" : "text-muted/70"}`}>
                {e.title}
                {current && <span className="ml-2 inline-block rounded-full bg-success/10 px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wider text-success">Atual</span>}
              </p>
              {e.done && e.at && <p className="mt-0.5 text-xs font-medium text-muted">{formatTrackingDate(e.at)}</p>}
              {e.done && e.description && <p className="mt-1 text-sm leading-relaxed text-muted">{e.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
