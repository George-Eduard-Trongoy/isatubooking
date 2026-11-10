import type { ReactNode } from "react";
import { BrandMark } from "@/components/site-header";

const IMAGE =
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1400&q=80";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-fade" />
        <div className="absolute bottom-10 left-10 right-10">
          <p className="eyebrow text-gold">ISATU Booking</p>
          <p className="mt-3 max-w-md font-display text-3xl font-semibold leading-tight text-ink-foreground">
            Reserve venues and campus rooms from one place.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-16 sm:px-10">
        <div className="w-full max-w-sm animate-rise">
          <BrandMark className="size-11" />
          <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
