import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, CalendarCheck, Compass, LayoutDashboard, ListOrdered, LogOut, Menu, Shield, Zap } from "lucide-react";
import { useState } from "react";

import { NotificationItem } from "@/components/shared/NotificationItem";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNotifications } from "@/hooks/use-sportshub";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/bookings", label: "My Bookings", icon: CalendarCheck },
  { to: "/waitlist", label: "Waitlist", icon: ListOrdered },
  { to: "/concurrency-demo", label: "Concurrency Demo", icon: Zap },
] as const;

function Logo() {
  return (
    <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent-gradient font-display text-sm font-bold text-primary-foreground">
        SH
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">SportsHub</span>
    </Link>
  );
}

export function Navbar() {
  const { profile, isAdmin, signOut, user } = useAuth();
  const { data: notifications } = useNotifications(user?.id);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const unread = (notifications ?? []).filter((n) => !n.read).length;
  const initials = (profile?.full_name || profile?.email || "S")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const items = isAdmin ? [...NAV_ITEMS, { to: "/admin", label: "Admin Dashboard", icon: Shield } as const] : NAV_ITEMS;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />

        <nav className="mx-auto hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="size-5" />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Notifications</p>
                {unread > 0 ? <Badge variant="secondary">{unread} new</Badge> : null}
              </div>
              <ScrollArea className="max-h-80">
                <div className="p-2">
                  {(notifications ?? []).length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No notifications yet. Book a slot to get started.
                    </p>
                  ) : (
                    (notifications ?? []).slice(0, 6).map((n) => <NotificationItem key={n.id} {...n} compact />)
                  )}
                </div>
              </ScrollArea>
              <div className="border-t border-border p-2">
                <Link to="/notifications" className="block">
                  <Button variant="ghost" size="sm" className="w-full">
                    View all notifications
                  </Button>
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="hidden h-10 items-center gap-2 px-2 lg:flex">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-28 truncate text-sm font-medium">{profile?.full_name || "Student"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-0.5">
                <p className="truncate text-sm font-medium">{profile?.full_name || "Student"}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{profile?.email}</p>
                <Badge variant="secondary" className="mt-1">
                  {isAdmin ? "Administrator" : "Student"}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/bookings">My bookings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/waitlist">My waitlist</Link>
              </DropdownMenuItem>
              {isAdmin ? (
                <DropdownMenuItem asChild>
                  <Link to="/admin">Admin dashboard</Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(88vw,20rem)] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{profile?.full_name || "Student"}</p>
                  <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
                </div>
              </div>
              <nav className="flex flex-col gap-1 p-3">
                {items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    )}
                    activeProps={{ className: "bg-secondary text-foreground" }}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/notifications"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  <Bell className="size-4" />
                  Notifications
                </Link>
              </nav>
              <div className="border-t border-border p-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setMobileOpen(false);
                    void handleSignOut();
                  }}
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
