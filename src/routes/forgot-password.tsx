import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/status-badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password | ISATU Booking" },
      { name: "description", content: "Request a password reset link for your ISATU Booking guest account." },
      { property: "og:title", content: "Reset your password | ISATU Booking" },
      { property: "og:description", content: "Get a secure link to set a new password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) return setError("Enter the email address on your account.");
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    setDone(true);
  };

  return (
    <AuthShell title="Reset your password" subtitle="Guests can reset by email. Staff should ask the system administrator.">
      {done ? (
        <FormMessage tone="success">If an account exists for that email, a reset link is on its way.</FormMessage>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-semibold text-foreground hover:underline">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
