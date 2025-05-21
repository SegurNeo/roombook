import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export function ConfirmEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [code, setCode] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  const inviteToken = location.state?.inviteToken as string | undefined;

  useEffect(() => {
    const verificationEmail = sessionStorage.getItem('verificationEmail');
    if (!verificationEmail) {
      navigate('/auth/signup');
      return;
    }
    setEmail(verificationEmail);
  }, [navigate]);

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsVerifying(true);
    setVerificationStatus('idle');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });

      if (error) throw error;

      if (data.user || data.session) {
        setVerificationStatus('success');
        toast({
          title: "Email verificado",
          description: "Tu cuenta ha sido verificada con éxito.",
        });
        sessionStorage.removeItem('verificationEmail');
        
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (inviteToken) {
          console.log('OTP verified (invite flow), invite token found via state, navigating to complete-invite:', inviteToken);
          navigate(`/auth/complete-invite?token=${inviteToken}`, { replace: true });
        } else {
          console.log('OTP verified (normal signup), no invite token. Navigating to /auth/onboarding');
          navigate("/auth/onboarding", { replace: true });
        }
      } else {
        setVerificationStatus('error');
        await new Promise(resolve => setTimeout(resolve, 1500));
        setVerificationStatus('idle');
        toast({
            title: "Verificación Podría Estar Incompleta",
            description: "El código fue aceptado, pero revisa si necesitas iniciar sesión.",
            variant: "default",
        });
      }
    } catch (error: any) {
      setVerificationStatus('error');
      await new Promise(resolve => setTimeout(resolve, 1500));
      setVerificationStatus('idle');
      toast({
        title: "Verification failed",
        description: error.message || "Please check your code and try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) return;

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) throw error;

      toast({
        title: "Code resent",
        description: "A new verification code has been sent to your email.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend code. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 6) {
      setCode(value);
      
      // Add animation class when code is complete
      if (value.length === 6) {
        e.target.classList.add('scale-pop');
        setTimeout(() => {
          e.target.classList.remove('scale-pop');
        }, 200);
      }
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4 text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          {verificationStatus === 'success' ? (
            <CheckCircle2 className="h-8 w-8 text-green-500 animate-success" />
          ) : verificationStatus === 'error' ? (
            <XCircle className="h-8 w-8 text-red-500 animate-error" />
          ) : (
            <Mail className="h-8 w-8 text-primary" />
          )}
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {verificationStatus === 'success' ? (
              "Email verified!"
            ) : verificationStatus === 'error' ? (
              "Verification failed"
            ) : (
              "Verify your email"
            )}
          </h1>
          <p className="text-muted-foreground">
            {verificationStatus === 'success' ? (
              "Your account has been verified successfully. Redirecting..."
            ) : verificationStatus === 'error' ? (
              "The verification code is incorrect. Please try again."
            ) : (
              <>
                We've sent a 6-digit verification code to <span className="font-medium">{email}</span>.
                Enter the code below to verify your account.
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleVerification} className="space-y-4">
          <div className="space-y-2">
            <div className={`relative group transition-all duration-300 ${
              verificationStatus === 'success' ? 'ring-2 ring-green-500/20' :
              verificationStatus === 'error' ? 'ring-2 ring-red-500/20' : ''
            }`}>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={handleCodeChange}
                className={`w-full text-center text-2xl tracking-[1em] py-6 rounded-lg border bg-transparent transition-all duration-200 
                         focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50
                         [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                         placeholder:text-muted-foreground/50 placeholder:tracking-normal placeholder:text-base ${
                           verificationStatus === 'success' ? 'border-green-500' :
                           verificationStatus === 'error' ? 'border-red-500' : ''
                         }`}
                maxLength={6}
                disabled={isVerifying || verificationStatus !== 'idle'}
                autoComplete="one-time-code"
                style={{ letterSpacing: code ? '1em' : 'normal' }}
              />
              <div className={`absolute inset-0 -z-10 rounded-lg transition-opacity duration-200 ${
                verificationStatus === 'success' ? 'bg-green-500/5' :
                verificationStatus === 'error' ? 'bg-red-500/5' : 'bg-primary/5 opacity-0 group-hover:opacity-100'
              }`} />
              <div className={`absolute bottom-0 left-0 h-0.5 w-full scale-x-0 transition-transform duration-200 ${
                verificationStatus === 'success' ? 'bg-green-500 scale-x-100' :
                verificationStatus === 'error' ? 'bg-red-500 scale-x-100' : 'bg-primary group-hover:scale-x-100'
              }`} />
            </div>
            <p className="text-sm text-muted-foreground">
              The code will expire in 6 hours
            </p>
          </div>

          <Button 
            type="submit" 
            className={`w-full ${
              verificationStatus === 'success' ? 'bg-green-500 hover:bg-green-600' :
              verificationStatus === 'error' ? 'bg-red-500 hover:bg-red-600' : ''
            }`}
            disabled={code.length !== 6 || isVerifying || verificationStatus !== 'idle'}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : verificationStatus === 'success' ? (
              "Verified!"
            ) : verificationStatus === 'error' ? (
              "Try Again"
            ) : (
              "Verify Email"
            )}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendCode}
              disabled={isVerifying || verificationStatus !== 'idle'}
            >
              Resend code
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/auth/login")}
              disabled={isVerifying || verificationStatus !== 'idle'}
            >
              Back to sign in
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}