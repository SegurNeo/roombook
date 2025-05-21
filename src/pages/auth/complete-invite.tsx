import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Extended InviteStatus to reflect the two-step process if needed, or simplify if generic errors are fine
// For now, keeping it somewhat generic, specific error messages will guide the user.
// type InviteStatus = 'loading' | 'validating' | 'finalizing' | 'success' | 'error' | 'invalid_token' | 'expired';
type InviteStatus = 'loading' | 'success' | 'error'; // Simplified for now

export function CompleteInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [message, setMessage] = useState<string>('Processing your invitation...'); // Initial message

  const token = searchParams.get("token");

  useEffect(() => {
    const processInvite = async () => {
      if (!token) {
        setStatus('error');
        setMessage('No invitation token provided.');
        toast({ title: 'Error', description: 'No invitation token provided.', variant: 'destructive' });
        return;
      }

      try {
        setStatus('loading');
        setMessage('Validating invitation...');

        // Step 1: Validate the invitation token
        const { data: validation, error: validationError } = await supabase
          .rpc('validate_team_invite', { invite_token: token });

        if (validationError) {
          console.error('Error validating invite:', validationError);
          setStatus('error');
          // Prefer specific messages from the error if available
          const detailedMessage = validationError.message.includes('=') 
            ? validationError.message.split('=').pop()?.trim() || 'Failed to validate invitation.'
            : validationError.message || 'Failed to validate invitation.';
          setMessage(detailedMessage);
          toast({ title: 'Validation Error', description: detailedMessage, variant: 'destructive' });
          return;
        }

        if (!validation || !validation.valid) {
          console.error('Invite validation failed:', validation);
          setStatus('error');
          const errorMessage = validation?.message || 'Invalid or expired invitation link.';
          setMessage(errorMessage);
          // Map specific validation error codes to user-friendly messages
          let userFriendlyMessage = errorMessage;
          if (validation?.error === 'INVALID_TOKEN_FORMAT') userFriendlyMessage = 'The invitation link format is incorrect.';
          else if (validation?.error === 'INVITE_NOT_FOUND') userFriendlyMessage = 'This invitation was not found or has expired.';
          else if (validation?.error === 'INVALID_TOKEN') userFriendlyMessage = 'The invitation link is invalid. It may have been tampered with.';
          
          setMessage(userFriendlyMessage);
          toast({ title: 'Invitation Invalid', description: userFriendlyMessage, variant: 'destructive' });
          return;
        }

        // At this point, validation.invite contains the invite details, including validation.invite.id (UUID)
        const inviteId = validation.invite.id;
        if (!inviteId) {
            setStatus('error');
            setMessage('Validated data is incomplete. Cannot finalize invite.');
            toast({ title: 'Error', description: 'Validated data is incomplete.', variant: 'destructive' });
            return;
        }

        setMessage('Finalizing invitation...');
        // Step 2: Finalize the invitation using the validated invite_id (UUID)
        const { error: finalizeError } = await supabase.rpc('finalize_team_invite', {
          p_invite_id: inviteId, // Pass the UUID
        });

        if (finalizeError) {
          console.error('Error finalizing invite:', finalizeError);
          setStatus('error');
          // Try to provide a more user-friendly message based on the error code from finalize_team_invite
          let detailedMessage = 'Could not accept the invitation. Please try again.';
          if (finalizeError.message) {
            const msg = finalizeError.message.toUpperCase(); // Normalize to uppercase for easier matching
            if (msg.includes('INVITE_NOT_FOUND')) detailedMessage = 'The invitation could not be found.';
            else if (msg.includes('INVITE_EXPIRED')) detailedMessage = 'This invitation has expired.';
            else if (msg.includes('INVITE_ALREADY_PROCESSED')) detailedMessage = 'This invitation has already been used or cancelled.';
            else if (msg.includes('EMAIL_MISMATCH')) detailedMessage = 'To accept this invite, you must be logged in with the email address that received it.';
            else if (msg.includes('USER_ALREADY_IN_ORGANIZATION')) detailedMessage = 'You are already a member of this organization.';
            else if (msg.includes('USER_ALREADY_IN_ANOTHER_ORGANIZATION')) detailedMessage = 'You are already a member of another organization. You can only belong to one.';
            else if (msg.includes('PROFILE_UPDATE_FAILED')) detailedMessage = 'There was an issue updating your profile.';
            else if (msg.includes('PROFILE_DOES_NOT_EXIST')) detailedMessage = 'Your user profile was not found. Please ensure you have completed initial sign up.';
            else detailedMessage = finalizeError.message; // Fallback to raw message if no specific match
          }
          setMessage(detailedMessage);
          toast({ title: 'Invitation Error', description: detailedMessage, variant: 'destructive', duration: 7000 });
        } else {
          setStatus('success');
          setMessage('Welcome! You have successfully joined the team.');
          toast({ 
            title: 'Success', 
            description: 'Invitation accepted! Redirecting to dashboard...' 
          });
          setTimeout(() => navigate('/', { replace: true }), 2000);
        }
      } catch (error: any) {
        console.error('Unexpected error during invite process:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again later or contact support.');
        toast({ 
          title: 'Error', 
          description: 'An unexpected error occurred. Please try again.', 
          variant: 'destructive' 
        });
      }
    };

    processInvite();
  // Removed `message` from dependency array to prevent re-triggering on setMessage
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, toast, navigate]); 

  const renderStatus = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-xl font-semibold">{message}</p>
            <p className="text-muted-foreground">Please wait...</p>
          </>
        );
      case 'success': // Renamed from 'valid' to 'success' for clarity
        return (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <p className="text-xl font-semibold">{message}</p>
            <p className="text-muted-foreground">Redirecting you shortly...</p>
          </>
        );
      case 'error':
        return (
          <>
            <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
            <p className="text-xl font-semibold">Invitation Issue</p>
            <p className="text-destructive mb-6">{message}</p>
            <Button onClick={() => navigate('/auth/login')}>Go to Login</Button>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-4 p-8 bg-card rounded-lg shadow-lg">
        {renderStatus()}
      </div>
    </div>
  );
} 