import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Wallet } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/components/auth-provider";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.86-3c-1.07.72-2.45 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.25 14.26a7.2 7.2 0 0 1 0-4.52V6.65H1.27a12 12 0 0 0 0 10.7l3.98-3.09Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.65l3.98 3.09C6.2 6.87 8.86 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function AuthDialog() {
  const { authOpen, setAuthOpen } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
    setAuthOpen(false);
    toast.success("Signed in");
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        setAuthOpen(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={authOpen} onOpenChange={setAuthOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="ink-panel mb-2 flex size-10 items-center justify-center rounded-xl">
            <Wallet className="size-5" />
          </span>
          <DialogTitle className="font-display text-2xl">
            {mode === "signin" ? "Sign in to FInvest" : "Create your FInvest account"}
          </DialogTitle>
          <DialogDescription>
            Save your budgets, loan comparisons and chats across devices. You can also keep browsing
            without an account.
          </DialogDescription>
        </DialogHeader>

        <Button variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={busy}>
          <GoogleMark />
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground uppercase">or with email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-name">Name</Label>
              <Input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                autoComplete="name"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
          <button type="button" className="hover:text-foreground" onClick={() => setAuthOpen(false)}>
            Continue as guest
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
