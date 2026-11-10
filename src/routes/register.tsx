import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { isStaffEmail } from "@/lib/identity";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create a guest account | ISATU Booking" },
      {
        name: "description",
        content: "Register as a guest to reserve ISATU venues and campus rooms.",
      },
      { property: "og:title", content: "Create a guest account | ISATU Booking" },
      {
        property: "og:description",
        content: "Register with your email to request venue and room reservations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!fullName.trim() || !mail || !password) return setError("Please fill in every field.");
    if (isStaffEmail(mail)) return setError("Please use your personal email address.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    const { error: err } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } },
    });
    setBusy(false);
    if (err)
      return setError(
        err.message.includes("weak")
          ? "Please choose a stronger password."
          : "Could not create the account. Please try again.",
      );
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a confirmation link to ${email.trim()}.`}
      >
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <MailCheck className="size-6 text-gold" />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Open the link to activate your account, then sign in. If you booked with us before, your
            earlier reservations will appear in My Bookings once your email is confirmed.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create a guest account"
      subtitle="Request venue and room reservations and follow their approval."
    >
      <form onSubmit={submit} className="space-y-5">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Create account
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
