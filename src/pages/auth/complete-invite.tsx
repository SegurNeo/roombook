import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type InviteStatus = 'loading' | 'valid' | 'invalid_token' | 'expired' | 'error';

export function CompleteInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [message, setMessage] = useState<string>('');

  const token = searchParams.get('token');

  useEffect(() => {
    const acceptInvite = async () => {
      if (!token) {
        setStatus('invalid_token');
        setMessage('No invitation token provided.');
        return;
      }

      try {
        const { error: inviteError } = await supabase.rpc('accept_team_invite', {
          invite_token: token,
        });

        if (inviteError) {
          console.error('Error calling accept_team_invite RPC:', inviteError);
          
          // Handle specific error cases
          if (inviteError.message.includes('INVALID_INVITE_TOKEN')) {
            setStatus('invalid_token');
            setMessage('This invitation link is invalid.');
          } else if (inviteError.message.includes('EXPIRED_INVITE_TOKEN')) {
            setStatus('expired');
            setMessage('This invitation has expired.');
          } else if (inviteError.message.includes('INVITE_ALREADY_PROCESSED')) {
            setStatus('invalid_token');
            setMessage('This invitation has already been processed.');
          } else if (inviteError.message.includes('EMAIL_MISMATCH')) {
            setStatus('error');
            setMessage('You must be logged in with the email address that received the invitation.');
          } else if (inviteError.message.includes('USER_ALREADY_MEMBER')) {
            setStatus('error');
            setMessage('You are already a member of this organization.');
          } else if (inviteError.message.includes('PROFILE_UPDATE_FAILED')) {
            setStatus('error');
            setMessage('Failed to update your profile. Please try again or contact support.');
          } else {
            setStatus('error');
            setMessage('An unexpected error occurred. Please try again or contact support.');
          }

          toast({
            title: 'Invitation Error',
            description: message,
            variant: 'destructive',
            duration: 7000,
          });
        } else {
          setStatus('valid');
          setMessage('Welcome! You have successfully joined the team.');
          toast({ 
            title: 'Success', 
            description: 'Invitation accepted! Redirecting to dashboard...' 
          });
          // Redirect to dashboard after a short delay
          setTimeout(() => navigate('/', { replace: true }), 2000);
        }
      } catch (error: any) {
        console.error('Unexpected error during invite acceptance:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again later or contact support.');
        toast({ 
          title: 'Error', 
          description: message, 
          variant: 'destructive' 
        });
      }
    };

    acceptInvite();
  }, [token, toast, navigate, message]);

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
      case 'valid':
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