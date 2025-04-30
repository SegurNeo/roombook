import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = 'loading' | 'success' | 'error';

export function CompleteInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('Processing your invitation...');

  const token = searchParams.get('token');

  useEffect(() => {
    const acceptInvite = async () => {
      if (!token) {
        setMessage('Invalid invitation link: No token found.');
        setStatus('error');
        toast({ title: 'Error', description: 'Missing invitation token.', variant: 'destructive' });
        return;
      }

      console.log('CompleteInvite page: Attempting to accept invite with token:', token);

      // Optional: Verify user session exists, though Supabase redirect should ensure this
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
           setMessage('Authentication error. Please log in again.');
           setStatus('error');
           toast({ title: 'Error', description: 'User session not found.', variant: 'destructive' });
           // Redirect to login?
           setTimeout(() => navigate('/auth/login'), 3000);
           return;
      }
      console.log('User session confirmed.');


      try {
        const { error: inviteError } = await supabase.rpc('accept_team_invite', {
          invite_token: token,
        });

        if (inviteError) {
          console.error('Error calling accept_team_invite RPC:', inviteError);
          // Provide more specific feedback based on common errors if possible
          if (inviteError.message.includes('already a member')) {
               setMessage('You are already a member of this team.');
          } else if (inviteError.message.includes('Invalid token')) {
               setMessage('This invitation link is invalid or has expired.');
          } else {
              setMessage(`Failed to accept invitation: ${inviteError.message}`);
          }
          setStatus('error');
          toast({
            title: 'Invitation Error',
            description: message, // Use the derived message
            variant: 'destructive',
            duration: 7000,
          });
        } else {
          console.log('Invitation accepted successfully via RPC.');
          setMessage('Welcome! You have successfully joined the team.');
          setStatus('success');
          toast({ title: 'Success', description: 'Invitation accepted!' });
          // Redirect to dashboard after a short delay
          setTimeout(() => navigate('/', { replace: true }), 2000);
        }
      } catch (error: any) {
        console.error('Unexpected error during invite acceptance:', error);
        setMessage('An unexpected error occurred. Please try again later or contact support.');
        setStatus('error');
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
    };

    acceptInvite();
    // Run only once on mount, dependencies are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, toast, navigate]); // Include navigate in deps

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
      case 'success':
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