import type { IconName } from "@/lib/domain";

/** Ícones de traço (mesma linguagem visual dos ícones da embalagem). */
const PATHS: Record<IconName, string> = {
  sparkle: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2zM5.5 15l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5L3.4 17.1l1.5-.6.6-1.5z",
  drop: "M12 3.5s-6 6.6-6 11a6 6 0 0012 0c0-4.4-6-11-6-11zM9.5 15.5a2.5 2.5 0 002.5 2.5",
  hand: "M8 11V5.5a1.5 1.5 0 013 0V11m0-1V4.5a1.5 1.5 0 013 0V11m0-.5V6a1.5 1.5 0 013 0v7.5a7 7 0 01-7 7h-.7a6 6 0 01-4.6-2.2L3.6 14.6a1.6 1.6 0 012.4-2.1L8 14.5V8.5a1.5 1.5 0 013 0",
  shield: "M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6L12 3zM8.8 12.2l2.2 2.2 4.2-4.4",
  leaf: "M5 19c0-8 5-13 14-14 0 9-5 14-13 14H5zM5 19l7-7",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5V12l3 2",
  truck: "M3 6.5h11v9H3zM14 9.5h3.6l3 3v3H14zM6.5 18.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM17.5 18.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z",
  lock: "M6 10.5h12v10H6zM8.5 10.5V7.5a3.5 3.5 0 017 0v3M12 14.5v2.5",
  chat: "M4 5.5h16v10.5H9.5L5.5 19.5V16H4zM8 9.5h8M8 12.5h5",
  pix: "M12 2.8l3.3 3.3-3.3 3.3-3.3-3.3zM12 14.6l3.3 3.3L12 21.2l-3.3-3.3zM2.8 12l3.3-3.3L9.4 12l-3.3 3.3zM14.6 12l3.3-3.3 3.3 3.3-3.3 3.3z",
  check: "M4.5 12.5l4.5 4.5L19.5 6.5",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
  box: "M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z",
};

export function Icon({ name, className = "h-6 w-6", strokeWidth = 1.6 }: { name: string; className?: string; strokeWidth?: number }) {
  const d = PATHS[(name in PATHS ? name : "check") as IconName];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
