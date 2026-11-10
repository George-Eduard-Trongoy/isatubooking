import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function BookingHero({
  image,
  backTo,
  backLabel,
  eyebrow,
  title,
  meta,
}: {
  image: string;
  backTo: "/venues" | "/rooms";
  backLabel: string;
  eyebrow: string;
  title: string;
  meta: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <Link
        to={backTo}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>
      <div className="relative mt-5 isolate overflow-hidden rounded-3xl">
        <img src={image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-hero-fade" />
        <div className="px-6 pb-8 pt-32 md:px-10 md:pt-44">
          <p className="eyebrow text-gold">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink-foreground md:text-5xl">{title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-foreground/80">
            {meta}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Event details", "Floor plan", "Documents"];
  return (
    <ol className="flex items-center gap-3 text-sm">
      {steps.map((s, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={s} className="flex items-center gap-3">
            <span
              className={
                active
                  ? "grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  : done
                    ? "grid size-7 place-items-center rounded-full bg-success text-xs font-bold text-ink-foreground"
                    : "grid size-7 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
              }
            >
              {n}
            </span>
            <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>
              {s}
            </span>
            {n < steps.length && <span className="h-px w-8 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
