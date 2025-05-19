import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Mail, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type InviteStatus = "loading" | "valid" | "invalid_token" | "already_member" | "expired" | "error";

interface InviteDetails {
  email: string;
  role_type: string;
  organization_name: string;
  organization_id: string;
}

export function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    const validateInvite = async () => {
      if (!token) {
        setStatus("invalid_token");
        setErrorMessage("No invitation token provided.");
        return;
      }

      try {
        setStatus("loading");
        
        // Use the new validate_team_invite function
        const { data: validation, error: validationError } = await supabase
          .rpc('validate_team_invite', { invite_token: token });

        if (validationError) throw validationError;

        if (!validation.valid) {
          setStatus(validation.error.toLowerCase() as InviteStatus);
          setErrorMessage(validation.message);
          return;
        }

        const invite = validation.invite;

        // Get organization details
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('name, id')
          .eq('id', invite.organization_id)
          .single();

        if (orgError) throw orgError;

        setStatus("valid");
        setInviteDetails({
          email: invite.email,
          role_type: invite.role_type,
          organization_name: org.name || 'the organization',
          organization_id: org.id
        });

      } catch (error: any) {
        console.error("Error validating invite:", error);
        setStatus("error");
        setErrorMessage(error.message || "An unexpected error occurred while validating the invite.");
        toast({
          title: "Error",
          description: "Failed to validate invitation.",
          variant: "destructive",
        });
      }
    };

    validateInvite();
  }, [token, toast]);

  const handleAuthRedirect = (mode: 'login' | 'signup') => {
    // Remove localStorage logic
    if (!token) return; // Should not happen if button is visible

    // Pass the original invite token via state for the next step
    const stateToPass = { 
        inviteToken: token, 
        ...(mode === 'signup' && inviteDetails && { invitedEmail: inviteDetails.email })
    };
    console.log(`Navigating to /auth/${mode} with state:`, stateToPass); // Log state
    navigate(`/auth/${mode}`, { state: stateToPass });
  };

  const renderContent = () => {
    switch (status) {
      case "loading":
        return (
          <div className="flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Validating invitation...</p>
          </div>
        );
      case "valid":
        if (!inviteDetails) return null; // Should not happen if status is valid
        return (
          <>
            <CardHeader>
              <CardTitle>Join {inviteDetails.organization_name}</CardTitle>
              <CardDescription>
                You've been invited to join {inviteDetails.organization_name} as a {inviteDetails.role_type}.
                Please sign up or log in to accept.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3 bg-muted p-3 rounded-md">
                 <Mail className="h-5 w-5 text-muted-foreground" />
                 <span className="font-medium">{inviteDetails.email}</span>
              </div>
               <Alert>
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Next Step</AlertTitle>
                 <AlertDescription>
                   Continue by signing up or logging in. Your invitation will be automatically applied after authentication.
                 </AlertDescription>
               </Alert>
            </CardContent>
            <CardFooter className="flex justify-between space-x-4">
              <Button className="flex-1" onClick={() => handleAuthRedirect('signup')}>
                 Sign Up <ArrowRight className="ml-2 h-4 w-4" />
               </Button>
               <Button variant="outline" className="flex-1" onClick={() => handleAuthRedirect('login')}>
                 Log In
               </Button>
            </CardFooter>
          </>
        );
      case "invalid_token":
      case "expired":
      case "already_member":
      case "error":
        return (
          <>
            <CardHeader>
              <CardTitle>Invitation Issue</CardTitle>
              <CardDescription>There was a problem with your invitation link.</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage || "An unknown error occurred."}</AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
               <Button asChild className="w-full">
                 <Link to="/auth/login">Go to Login</Link>
               </Button>
            </CardFooter>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        {renderContent()}
      </Card>
    </div>
  );
} 