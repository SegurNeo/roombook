import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Mail, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type InviteStatus = "loading" | "valid" | "invalid_token" | "already_member" | "expired" | "error";

// Define the expected structure for the organization within the invite
interface InvitedOrganization {
  name: string;
  id: string;
}

// Define the expected structure for the invite response
interface InviteResponse {
  email: string;
  role_type: string;
  status: string;
  expires_at: string;
  organizations: InvitedOrganization | null; // Define the nested type
}

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
        // Explicitly type the expected response
        const { data: invite, error: inviteError } = await supabase
          .from("team_invites")
          .select(`
            email,
            role_type,
            status,
            expires_at,
            organizations ( name, id )
          `)
          .eq("id", token)
          .maybeSingle<InviteResponse>(); // Use the defined type

        if (inviteError) throw inviteError;

        if (!invite) {
          setStatus("invalid_token");
          setErrorMessage("Invalid or expired invitation token.");
          return;
        }

        if (invite.status !== 'pending' && invite.status !== 'sent') {
             setStatus("invalid_token"); // Or a more specific status like 'already_processed'
             setErrorMessage(`This invitation has already been ${invite.status}.`);
             return;
        }
        
        const expiresAt = new Date(invite.expires_at);
        if (expiresAt < new Date()) {
            setStatus("expired");
            setErrorMessage("This invitation has expired.");
            // Optional: Update status to 'expired' in DB if not already done by a cron job
            return;
        }

        // If validation passed (basic checks: token exists, not expired, status ok)
        setStatus("valid");
        setInviteDetails({
          email: invite.email,
          role_type: invite.role_type,
          organization_name: invite.organizations?.name || 'the organization',
          organization_id: invite.organizations?.id || '',
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
    // Pass invite token ONLY via localStorage
    if (token) {
      console.log('Storing invite token in localStorage:', token); // Added log
      localStorage.setItem('pendingInviteToken', token);
    }
    // Remove passing token via state
    navigate(`/auth/${mode}`); 
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