import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { roleLabel } from "@/lib/identity";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home" },
  { to: "/venues", label: "Venues" },
  { to: "/rooms", label: "Rooms" },
] as const;

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 place-items-center rounded-lg bg-gradient-ink font-display text-sm font-bold text-gold ring-1 ring-gold/40",
        className,
      )}
    >
      IS
    </span>
  );
}

export function SiteHeader() {
  const { me, session, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <BrandMark />
          <span className="leading-tight">
            <span className="block font-display text-[0.95rem] font-semibold text-foreground">
              ISATU Booking
            </span>
            <span className="block text-[0.7rem] font-medium text-muted-foreground">
              Venues and Accommodation
            </span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          {session && (
            <Link
              to="/my-bookings"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground"
            >
              My Bookings
            </Link>
          )}
          {isStaff && (
            <Link
              to="/admin"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground"
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-left shadow-soft transition-colors hover:bg-muted">
                  <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                    {(me?.full_name || "U").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="leading-tight">
                    <span className="block max-w-36 truncate text-sm font-semibold">
                      {me?.full_name || "Account"}
                    </span>
                    <span className="block text-[0.7rem] text-muted-foreground">
                      {me ? roleLabel(me.role, me.facility_code) : " "}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {me?.email ?? (me?.username ? `@${me.username}` : "")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isStaff && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                    <LayoutDashboard /> Admin dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate({ to: "/account" })}>
                  <UserRound /> Account and password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild variant="default" size="sm">
                <Link to="/register">Create account</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="ml-auto grid size-9 place-items-center rounded-md border border-border md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1" onClick={() => setOpen(false)}>
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            {session && (
              <Link
                to="/my-bookings"
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                My Bookings
              </Link>
            )}
            {isStaff && (
              <Link to="/admin" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                Admin
              </Link>
            )}
            {session ? (
              <>
                <Link
                  to="/account"
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Account
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">
              Iloilo Science and Technology University
            </p>
            <p className="text-xs text-muted-foreground">
              HRT Center and TLE Service Center booking portal
            </p>
          </div>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <Link to="/venues" className="hover:text-foreground">
            Venues
          </Link>
          <Link to="/rooms" className="hover:text-foreground">
            Rooms
          </Link>
          <Link to="/my-bookings" className="hover:text-foreground">
            My Bookings
          </Link>
        </div>
      </div>
    </footer>
  );
}
