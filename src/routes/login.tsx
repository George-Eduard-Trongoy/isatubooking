import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { toAuthEmail } from "@/lib/identity";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in | ISATU Booking" },
      { name: "description", content: "Sign in to manage your ISATU venue and room reservations." },
      { property: "og:title", content: "Sign in | ISATU Booking" },
      { property: "og:description", content: "Access your reservations or the facility administration portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function safeRedirect(target?: string) {
  if (!target) return null;
  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Enter your email or username and your password.");
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: toAuthEmail(identifier),
      password,
    });
    if (err || !data.user) {
      setBusy(false);
      setError(
        err?.message?.toLowerCase().includes("confirm")
          ? "Please confirm your email address first. Check your inbox for the link."
          : "Incorrect email, username or password.",
      );
      return;
    }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const staff = (roles ?? []).some((r) => r.role === "admin" || r.role === "venue_admin");
    const target = safeRedirect(redirect);
    if (target) window.location.assign(target);
    else navigate({ to: staff ? "/admin" : "/" });
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to book venues and rooms or manage your facility.">
      <form onSubmit={submit} className="space-y-5">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <div className="space-y-2">
          <Label htmlFor="identifier">Email or username</Label>
          <Input
            id="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">Guests use their email. Staff use their assigned username.</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Sign in
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New guest?{" "}
          <Link to="/register" className="font-semibold text-foreground hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
