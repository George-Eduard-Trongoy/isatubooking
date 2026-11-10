import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  pending: "bg-warning-soft text-warning ring-warning/25",
  approved: "bg-success-soft text-success ring-success/25",
  rejected: "bg-danger-soft text-destructive ring-destructive/20",
  cancelled: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset",
        styles[status] ?? styles["cancelled"],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

const paymentStyles: Record<string, { label: string; cls: string }> = {
  unpaid: { label: "Unpaid", cls: "bg-warning-soft text-warning ring-warning/25" },
  partial: { label: "Downpayment paid", cls: "bg-gold-soft text-accent-foreground ring-gold/30" },
  paid: { label: "Paid in full", cls: "bg-success-soft text-success ring-success/25" },
  refunded: { label: "Refunded", cls: "bg-muted text-muted-foreground ring-border" },
};

export function PaymentBadge({ status, className }: { status: string; className?: string }) {
  const s = paymentStyles[status] ?? paymentStyles["unpaid"]!;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        s.cls,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string | undefined;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow text-gold">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground md:text-4xl">{title}</h1>
        {description && (
          <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-4 py-3 text-sm ring-1 ring-inset",
        tone === "error" && "bg-danger-soft text-destructive ring-destructive/20",
        tone === "success" && "bg-success-soft text-success ring-success/25",
        tone === "info" && "bg-gold-soft text-accent-foreground ring-gold/30",
      )}
    >
      {children}
    </div>
  );
}
