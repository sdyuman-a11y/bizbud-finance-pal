import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export function HeaderControls() {
  const { user, profile, setAuthOpen, signOut } = useAuth();

  const label = profile?.display_name ?? user?.email?.split("@")[0] ?? "";

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      {user ? (
        <div className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-1 pl-3">
          <span className="hidden max-w-[9rem] truncate text-xs font-semibold sm:inline">{label}</span>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <UserIcon className="size-3.5" />
            </span>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <LogIn className="size-3.5" />
          Sign in
        </button>
      )}
    </div>
  );
}
