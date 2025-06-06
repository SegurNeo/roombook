import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export function Login() {
  const location = useLocation();
  console.log('[Login.tsx] Rendering - Path:', location.pathname, 'State:', location.state);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check for session on mount
  useEffect(() => {
    console.log('[Login.tsx] Checking for existing session on mount.');
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const from = location.state?.from?.pathname || "/";
        console.log('[Login.tsx] Active session found. Redirecting to:', from);
        navigate(from, { replace: true });
      } else {
        console.log('[Login.tsx] No active session found on mount.');
      }
    };
    checkSession();
  }, [navigate, location.state]);

  const inviteToken = location.state?.inviteToken;
  useEffect(() => {
    if (inviteToken) {
      console.log('Login page received inviteToken from state:', inviteToken);
    }
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Login handleSubmit triggered");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const signInOptions: { redirectTo?: string; captchaToken?: string } = {};
      if (inviteToken) {
        signInOptions.redirectTo = `${window.location.origin}/auth/complete-invite?token=${inviteToken}`;
        console.log('Login initiated with invite, setting redirectTo:', signInOptions.redirectTo);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: signInOptions,
      });

      if (error) throw error;

      if (data?.user) {
        if (!inviteToken) {
          toast({
            title: "Welcome back!",
            description: "You have successfully signed in.",
          });
          const from = location.state?.from?.pathname || "/";
          console.log('[Login.tsx] Login successful. Redirecting to:', from);
          navigate(from, { replace: true });
        } else {
          toast({ title: "Login successful", description: "Processing invitation..." });
        }
      }
    } catch (error: any) {
      console.error("Supabase SignIn Error:", error);
      toast({
        title: "Error",
        description: (error as Error).message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      console.log("Setting isLoading to false");
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const oauthOptions: { redirectTo?: string; queryParams?: { [key: string]: string } } = {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      };
      if (inviteToken) {
        oauthOptions.redirectTo = `${window.location.origin}/auth/complete-invite?token=${inviteToken}`;
        console.log('Google Sign-In initiated with invite, setting redirectTo:', oauthOptions.redirectTo);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: oauthOptions,
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: (error as Error).message || "An error occurred while signing in with Google",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Welcome back</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Button variant="link" className="p-0" onClick={() => navigate("/auth/signup")}>
              Sign up
            </Button>
          </p>
        </div>

        <div className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              className="w-4 h-4 mr-2"
            />
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}