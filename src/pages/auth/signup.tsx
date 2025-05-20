import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function SignUp() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Read invite details from location state
  const inviteToken = location.state?.inviteToken;
  const invitedEmail = location.state?.invitedEmail;
  const isEmailDisabled = !!invitedEmail;

  useEffect(() => {
    if (invitedEmail) {
      setEmail(invitedEmail);
      console.log('Pre-filling email from invite:', invitedEmail);
    }
  }, [invitedEmail]);

  const validatePassword = (password: string): boolean => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    console.log('handleSubmit called');
    event.preventDefault();

    console.log('Password:', password);
    console.log('Confirm Password:', confirmPassword);
    console.log('Passwords match?:', password === confirmPassword);
    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    const isPasswordValid = validatePassword(password);
    console.log('Password valid?:', isPasswordValid);
    if (!isPasswordValid) {
       toast({
         title: "Contraseña Débil",
         description: "La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y carácter especial (@$!%*?&).",
         variant: "destructive",
         duration: 9000,
       });
       return;
     }

    console.log('Agreed to terms?:', agreedToTerms);
    if (!agreedToTerms) {
      toast({
        title: "Terms Not Agreed",
        description: "You must agree to the terms and conditions.",
        variant: "destructive",
      });
      return;
    }

    console.log('All validations passed, setting loading...');
    setIsLoading(true);

    try {
      // Prepare options for signUp
      const signUpOptions: { emailRedirectTo?: string; data?: { [key: string]: any } } = {};
      signUpOptions.data = { full_name: fullName }; 

      if (inviteToken) {
        // Restore emailRedirectTo for invite flow
        signUpOptions.emailRedirectTo = `${window.location.origin}/auth/complete-invite?token=${inviteToken}`;
        console.log('Signup initiated with invite, setting emailRedirectTo:', signUpOptions.emailRedirectTo);
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: signUpOptions,
      });

      if (error) throw error;

      // Handle response
      if (data.session) {
        // If auto-confirm is on OR a session is returned immediately (e.g. user already confirmed but not fully through invite)
        // And there was an invite token, redirect to complete-invite directly
        if (inviteToken) {
          console.log('User signed up and session created (or auto-confirmed), redirecting to complete-invite with token:', inviteToken);
          navigate(`/auth/complete-invite?token=${inviteToken}`, { replace: true });
        } else {
          // Navigate to a default page or onboarding if no invite token
          // This case might need adjustment based on whether you always expect email verification
          navigate('/', { replace: true }); 
        }
      } else if (data.user && !data.session) {
        // User needs to verify email (OTP or link via email)
        // Supabase will handle redirection to `emailRedirectTo` after verification
        toast({
          title: "Revisa tu correo electrónico",
          description: "Hemos enviado un correo de confirmación. Por favor, sigue las instrucciones para activar tu cuenta y completar la invitación si aplica.",
          duration: 9000,
        });
        // If you have a custom OTP page (/auth/confirm-email) and are NOT relying on Supabase's email link:
        // You still need to navigate the user there.
        // The `emailRedirectTo` will be used by Supabase AFTER `verifyOtp` is successful on that page.
        sessionStorage.setItem('verificationEmail', email);
        // Pass inviteToken to confirm-email page if it needs to reconstruct the complete-invite URL later
        // However, with emailRedirectTo set, this might not be strictly necessary for confirm-email to pass it on,
        // as Supabase should handle the final redirect.
        const stateToPass = inviteToken ? { inviteToken,  requiresOtp: true } : { requiresOtp: true };
        console.log('Navigating to confirm-email, Supabase will use emailRedirectTo after OTP verification. State:', stateToPass);
        navigate('/auth/confirm-email', { state: stateToPass });
      } else {
        // Fallback or unexpected state
        toast({
          title: "Proceso de registro iniciado",
          description: "Por favor, sigue las instrucciones enviadas a tu correo electrónico.",
          duration: 7000
        });
      }

    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.message.includes("User already registered")) {
         toast({
           title: "Signup Failed",
           description: "An account with this email already exists. Please log in instead.",
           variant: "destructive",
         });
      } else {
        toast({
          title: "Signup Failed",
          description: error.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      // The redirect will happen automatically
      // No need to handle the response here
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while signing in with Google",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Create your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Button variant="link" className="p-0" onClick={() => navigate("/auth/login")}>
              Sign in
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
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="John Doe"
                required
                disabled={isLoading}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={isEmailDisabled ? "" : "john@example.com"}
                required
                disabled={isEmailDisabled}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                title="Please enter a valid email address"
                className={isEmailDisabled ? "bg-muted/50" : ""}
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="pr-10"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Checkbox
                id="agreedToTerms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                disabled={isLoading}
              >
                Acepto los{" "}
                <Link to="/terms" className="text-sm text-primary hover:underline">
                  términos y condiciones
                </Link>
              </Checkbox>
            </div>

            <Button 
              className="w-full" 
              type="submit" 
              disabled={isLoading || !agreedToTerms}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                "Crear cuenta"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}