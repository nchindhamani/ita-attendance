import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      setError("Email and password are required");
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Check if user has an active, approved profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("id,is_active,is_approved")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!profile) {
          setError("Profile not found. Please contact an administrator.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        if (!profile.is_active) {
          setError("Your account has been deactivated. Please contact an administrator.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        if (!profile.is_approved) {
          // Redirect to pending approval page
          navigate("/pending");
          return;
        }

        // Success - redirect to dashboard
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input name="email" type="email" placeholder="teacher@ita.org" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <Input name="password" type="password" required />
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

