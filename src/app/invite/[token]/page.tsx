'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { getInvitationByToken, acceptInvitation } from '@/lib/supabase/user-validation-service';
import { toast } from 'sonner';
import { Loader2, MapPin, Eye, Edit, UserPlus, CheckCircle, XCircle } from 'lucide-react';

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'accepted'>('loading');
  const [supabase] = useState(() => createClient());
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    params.then(p => {
      setToken(p.token);
      checkInvitation(p.token);
    });
  }, []);

  const checkInvitation = async (tokenValue: string) => {
    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Get invitation details
      const invitationData = await getInvitationByToken(tokenValue);
      
      if (!invitationData) {
        setStatus('invalid');
        setLoading(false);
        return;
      }

      setInvitation(invitationData);

      // Check invitation status
      if (invitationData.status === 'accepted') {
        setStatus('accepted');
      } else if (invitationData.status === 'expired' || 
                 (invitationData.expires_at && new Date(invitationData.expires_at) < new Date())) {
        setStatus('expired');
      } else {
        setStatus('valid');
      }
    } catch (error) {
      console.error('Error checking invitation:', error);
      setStatus('invalid');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!currentUser) {
      // Redirect to login with return URL
      const returnUrl = `/invite/${token}`;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    if (currentUser.email !== invitation.invitee_email) {
      toast.error('This invitation was sent to a different email address');
      return;
    }

    setAccepting(true);

    try {
      const result = await acceptInvitation(token, currentUser.email);
      
      if (result.success) {
        toast.success('Invitation accepted successfully!');
        setStatus('accepted');
        
        // Redirect to the map with the shared pin
        setTimeout(() => {
          router.push(`/map-drawing?pin=${result.pinId}`);
        }, 1500);
      } else {
        toast.error(result.error || 'Failed to accept invitation');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast.error('Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const getPermissionIcon = (permission: string) => {
    return permission === 'edit' ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />;
  };

  const getPermissionLabel = (permission: string) => {
    return permission === 'edit' ? 'Can Edit' : 'View Only';
  };

  const getPermissionDescription = (permission: string) => {
    return permission === 'edit' 
      ? 'You will be able to upload files, delete content, and modify the pin'
      : 'You will be able to view the pin and download files';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has been removed.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please request a new invitation from the sender.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Invitation Already Accepted</CardTitle>
            <CardDescription>
              This invitation has already been accepted. The pin should be available in your map.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push('/map-drawing')} className="w-full">
              Go to Map
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Pin Invitation</CardTitle>
          <CardDescription>
            You've been invited to collaborate on a pin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {invitation && (
            <>
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Pin Name</p>
                    <p className="font-medium text-lg">
                      {invitation.pins?.name || 'Unnamed Pin'}
                    </p>
                  </div>
                  
                  {invitation.pins?.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-sm">{invitation.pins.description}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {getPermissionIcon(invitation.permission_level)}
                      {getPermissionLabel(invitation.permission_level)}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    {getPermissionDescription(invitation.permission_level)}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground mb-1">Invited to</p>
                  <p className="font-medium">{invitation.invitee_email}</p>
                </div>
              </div>

              {!currentUser ? (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">
                    Please sign in or create an account to accept this invitation
                  </p>
                  <Button 
                    onClick={handleAcceptInvitation} 
                    className="w-full"
                    size="lg"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign In to Accept
                  </Button>
                </div>
              ) : currentUser.email === invitation.invitee_email ? (
                <Button 
                  onClick={handleAcceptInvitation} 
                  className="w-full"
                  size="lg"
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept Invitation
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                    <p className="text-sm text-yellow-800">
                      This invitation was sent to <strong>{invitation.invitee_email}</strong>.
                      You are currently signed in as <strong>{currentUser.email}</strong>.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      supabase.auth.signOut();
                      router.push(`/login?returnUrl=${encodeURIComponent(`/invite/${token}`)}`);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Sign In with Different Account
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}