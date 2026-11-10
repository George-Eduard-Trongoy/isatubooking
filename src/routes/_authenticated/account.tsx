import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage, PageIntro } from "@/components/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel } from "@/lib/identity";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account | ISATU Booking" },
      { name: "description", content: "Review your account and change your password." },
      { property: "og:title", content: "Account | ISATU Booking" },
      { property: "og:description", content: "Manage your ISATU Booking account." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { me, session } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 10) return setError("Use at least 10 characters for your new password.");
    if (next !== confirm) return setError("The new passwords do not match.");
    const email = session?.user.email;
    if (!email) return;
    setBusy(true);
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setBusy(false);
      return setError("Your current password is incorrect.");
    }
    const { error: err } = await supabase.auth.updateUser({
      password: next,
      current_password: current,
    } as never);
    setBusy(false);
    if (err) return setError("Could not update your password. Try a stronger one.");
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password updated.");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <PageIntro
        eyebrow="Account"
        title={me?.full_name || "Your account"}
        description={
          me
            ? `${roleLabel(me.role, me.facility_code)} · ${me.email ?? `@${me.username}`}`
            : undefined
        }
      />
      <form
        onSubmit={submit}
        className="mt-10 max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft"
      >
        <h2 className="text-lg font-semibold">Change password</h2>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <div className="space-y-2">
          <Label htmlFor="current">Current password</Label>
          <Input
            id="current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next">New password</Label>
          <Input
            id="next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-11"
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy && <Loader2 className="animate-spin" />} Update password
        </Button>
      </form>
    </div>
  );
}
