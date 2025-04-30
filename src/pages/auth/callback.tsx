import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

export function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error during auth callback:', error);
        navigate('/auth/login');
        return;
      }

      if (data?.session) {
        // Check for pending invite token after successful OAuth
        const inviteToken = localStorage.getItem('pendingInviteToken');

        if (inviteToken) {
          console.log('OAuth successful, attempting to accept invite with token from localStorage:', inviteToken);
          try {
            const { error: inviteError } = await supabase.rpc('accept_team_invite', {
              invite_token: inviteToken
            });

            if (inviteError) throw inviteError;

            toast({
              title: "Invite Accepted",
              description: "You have successfully joined the team via OAuth!",
            });
            localStorage.removeItem('pendingInviteToken'); // Clean up token

          } catch (inviteError: any) {
            console.error('Error accepting team invite post-OAuth:', inviteError);
            toast({
              title: "Invite Acceptance Issue",
              description: `OAuth login successful, but failed to automatically accept the team invitation: ${inviteError.message}. Please contact support or try accepting later.`,
              variant: "destructive",
              duration: 10000,
            });
            // Decide if we should still remove the token or let the user retry?
            localStorage.removeItem('pendingInviteToken'); // Clean up token even on error for now
          }
        }

        navigate('/');
      } else {
        navigate('/auth/login');
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-lg">Completing sign in...</p>
      </div>
    </div>
  );
}