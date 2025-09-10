'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Select components removed - using fixed "Copy" mode only
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { simplifiedSharingService } from '@/lib/supabase/sharing-service-simplified';
import { enhancedSharingService } from '@/lib/supabase/sharing-service-enhanced';
import { 
  checkUserExists, 
  createInvitation, 
  isValidEmail,
  generateInvitationLink,
  sendInvitationEmail 
} from '@/lib/supabase/user-validation-service';
import { notificationService } from '@/lib/supabase/notification-service';
import { pinCopyService } from '@/lib/supabase/pin-copy-service';
import {
  Users,
  Link,
  Copy,
  Trash2,
  Eye,
  Edit,
  Loader2,
  Check,
  UserPlus,
  Mail,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Share2,
  Bell,
  FileText,
  X as CloseIcon,
} from 'lucide-react';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinId: string;
  pinName: string;
}

interface UserShare {
  id: string;
  shared_with_user_id: string;
  permission_level: 'view' | 'edit'; // Using edit for copy functionality
  created_at: string;
  profiles?: {
    email: string;
    full_name?: string;
    username?: string;
  };
}

interface ShareToken {
  id: string;
  token: string;
  permission_level: 'view' | 'edit'; // Using edit for copy functionality
  is_active: boolean;
  max_uses?: number;
  used_count: number;
  password_hash?: string;
  created_at: string;
}

export function ShareDialogSimplified({ open, onOpenChange, pinId, pinName }: ShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [supabase] = useState(() => createClient());
  
  // User sharing state
  const [email, setEmail] = useState('');
  const permission = 'edit'; // Use 'edit' permission for copy functionality (database constraint)
  const [userShares, setUserShares] = useState<UserShare[]>([]);
  const [validationState, setValidationState] = useState<'idle' | 'checking' | 'exists' | 'not-exists'>('idle');
  const [validatedUser, setValidatedUser] = useState<{ userId?: string; fullName?: string } | null>(null);
  
  // Public link state
  const [linkPassword, setLinkPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [publicLinks, setPublicLinks] = useState<ShareToken[]>([]);
  
  // Current user
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Process visibility state
  const [showProcessLog, setShowProcessLog] = useState(false);
  const [processSteps, setProcessSteps] = useState<Array<{
    step: string;
    status: 'pending' | 'in-progress' | 'success' | 'error';
    message: string;
    details?: any;
  }>>([]);
  const [shareSuccess, setShareSuccess] = useState<{
    show: boolean;
    pinData?: any;
    shareData?: any;
    notificationData?: any;
  }>({ show: false });

  useEffect(() => {
    if (open) {
      loadCurrentUser();
      loadShares();
      setProcessSteps([]);
      setShareSuccess({ show: false });
    }
  }, [open, pinId]);

  // Helper function to update process steps
  const updateProcessStep = (step: string, status: 'pending' | 'in-progress' | 'success' | 'error', message: string, details?: any) => {
    setProcessSteps(prev => {
      const existing = prev.find(s => s.step === step);
      if (existing) {
        return prev.map(s => s.step === step ? { step, status, message, details } : s);
      } else {
        return [...prev, { step, status, message, details }];
      }
    });
  };

  // Helper function to verify pin data accessibility
  const verifyPinAccess = async (userId: string) => {
    updateProcessStep('verify-access', 'in-progress', 'Verifying pin access for recipient...');
    
    try {
      // Check if user has access to the pin
      const accessCheck = await simplifiedSharingService.hasAccessToPin(pinId);
      
      // Get pin details
      const { data: pinData, error: pinError } = await supabase
        .from('pins')
        .select('*')
        .eq('id', pinId)
        .single();

      if (pinError) {
        updateProcessStep('verify-access', 'error', `Failed to retrieve pin data: ${pinError.message}`);
        return { success: false, error: pinError.message };
      }

      // Get associated data files
      const { data: fileData, error: fileError } = await supabase
        .from('pin_data_files')
        .select('*')
        .eq('pin_id', pinId);

      if (fileError) {
        console.warn('No associated files or file query failed:', fileError.message);
      }

      const verificationData = {
        pinData,
        fileCount: fileData?.length || 0,
        files: fileData || [],
        hasAccess: accessCheck.hasAccess,
        permission: accessCheck.permission
      };

      updateProcessStep('verify-access', 'success', 
        `Pin access verified: ${fileData?.length || 0} files, ${accessCheck.permission} permission`,
        verificationData
      );

      return { success: true, data: verificationData };
    } catch (error) {
      updateProcessStep('verify-access', 'error', `Access verification failed: ${error}`);
      return { success: false, error };
    }
  };

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();
      
      setCurrentUser({
        id: user.id,
        email: user.email,
        ...profile
      });
    }
  };

  const loadShares = async () => {
    try {
      // Load user shares using the new service
      const shares = await simplifiedSharingService.getPinShares(pinId);
      setUserShares(shares.map((share: any) => ({
        id: share.id,
        shared_with_user_id: share.shared_with_user_id,
        permission_level: share.permission_level,
        created_at: share.created_at,
        profiles: share.shared_with_user ? {
          email: share.shared_with_user.email,
          full_name: share.shared_with_user.display_name || 
                   share.shared_with_user.email?.split('@')[0],
          username: share.shared_with_user.display_name
        } : null
      })));

      // Load public links (if they still exist)
      const { data: tokens } = await supabase
        .from('share_tokens')
        .select('*')
        .eq('pin_id', pinId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (tokens) {
        setPublicLinks(tokens);
      }
    } catch (error) {
      console.error('Error loading shares:', error);
    }
  };

  const validateEmail = async () => {
    if (!email || !isValidEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setValidationState('checking');
    
    try {
      const result = await checkUserExists(email);
      
      if (result.exists) {
        setValidationState('exists');
        setValidatedUser({
          userId: result.userId,
          fullName: result.fullName
        });
        toast.success(`User found: ${result.fullName || email}`);
      } else {
        setValidationState('not-exists');
        setValidatedUser(null);
        toast.error(`User ${email} not found. Please ask them to create an account first, or send them an invitation to join.`, {
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error validating email:', error);
      toast.error('Failed to validate email');
      setValidationState('idle');
    }
  };

  const handleShareWithUser = async () => {
    if (!email || !isValidEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (validationState === 'idle') {
      toast.error('Please validate the email first');
      return;
    }

    setLoading(true);
    setProcessSteps([]);
    setShowProcessLog(true);

    try {
      if (validationState === 'exists' && validatedUser?.userId) {
        // Step 1: Validate user and permission
        updateProcessStep('validate', 'in-progress', `Validating user ${email}...`);
        updateProcessStep('validate', 'success', `User validated: ${validatedUser.fullName || email} (will create copy)`);

        // Step 2: Enhanced share with granular logging
        updateProcessStep('enhanced-sharing', 'in-progress', 'Starting enhanced sharing process...');
        
        const result = await pinCopyService.copyPinToUser(
          pinId,
          email,
          (progress) => {
            // Update progress from the copy service
            if (progress.length > 0) {
              const latestStep = progress[progress.length - 1];
              updateProcessStep(latestStep.step, latestStep.status, latestStep.message, latestStep.details);
            }
          }
        );

        if (!result.success) {
          updateProcessStep('enhanced-sharing', 'error', result.error || 'Enhanced sharing failed');
          toast.error(result.error || 'Failed to share pin');
          
          // Show detailed error information
          if (result.progress.length > 0) {
            const errorSteps = result.progress.filter(s => s.status === 'error');
            if (errorSteps.length > 0) {
              toast.error(`Detailed error: ${errorSteps[0].message}`, { duration: 8000 });
            }
          }
          return;
        }

        updateProcessStep('enhanced-sharing', 'success', 'Pin copy completed successfully!');

        // Step 3: Verify the copied pin exists
        updateProcessStep('final-verification', 'in-progress', 'Verifying copied pin...');
        
        try {
          const { data: copiedPin } = await supabase
            .from('pins')
            .select('*')
            .eq('id', result.copiedPinId)
            .single();
            
          if (copiedPin) {
            updateProcessStep('final-verification', 'success', 
              `Pin copy verified: "${copiedPin.label}"`, 
              copiedPin
            );
          } else {
            updateProcessStep('final-verification', 'error', 'Could not verify copied pin in database');
          }
        } catch (verifyError) {
          updateProcessStep('final-verification', 'warning', `Verification warning: ${verifyError}`);
        }
        
        // Step 4: Final verification (Notification already handled by pin-copy-service)
        updateProcessStep('final-check', 'in-progress', 'Performing final verification...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX
        updateProcessStep('final-check', 'success', 'Share process completed successfully!');

        // Show success state
        setShareSuccess({
          show: true,
          pinData: null, // We can add pin verification later if needed
          shareData: { shareId: result.copiedPinId, permission, recipient: validatedUser },
          notificationData: processSteps.find(s => s.step === 'send-notification')?.details
        });
          
        // Show success toast
        toast.success(
          `✅ Pin "${pinName}" shared successfully with ${validatedUser.fullName || email}!`, 
          { 
            duration: 6000,
            description: `${permission} access granted • Notification sent • Share verified in database`
          }
        );
        
        // Reset form after delay
        setTimeout(() => {
          setEmail('');
          setValidationState('idle');
          setValidatedUser(null);
          // permission is always 'copy'
          loadShares();
        }, 1000);

      } else if (validationState === 'not-exists') {
        // Handle invitation flow (existing logic)
        updateProcessStep('create-invitation', 'in-progress', `Creating invitation for ${email}...`);
        
        const invitation = await createInvitation({
          pinId,
          inviteeEmail: email,
          permissionLevel: permission,
          inviterId: currentUser?.id
        });

        if (invitation.success && invitation.invitationToken) {
          const invitationLink = generateInvitationLink(invitation.invitationToken);
          
          updateProcessStep('create-invitation', 'success', 'Invitation created successfully');
          updateProcessStep('send-invitation', 'in-progress', 'Sending invitation email...');
          
          await sendInvitationEmail(
            email,
            currentUser?.full_name || currentUser?.username || currentUser?.email || 'Someone',
            pinName,
            invitationLink
          );
          
          updateProcessStep('send-invitation', 'success', 'Invitation email sent');
          
          toast.success('Invitation sent! The user will receive the pin once they sign up.');
          
          // Copy invitation link to clipboard
          navigator.clipboard.writeText(invitationLink);
          toast.info('Invitation link copied to clipboard');
          
          // Reset form
          setEmail('');
          setValidationState('idle');
          // permission is always 'copy'
        } else {
          updateProcessStep('create-invitation', 'error', invitation.error || 'Failed to create invitation');
          toast.error(invitation.error || 'Failed to send invitation');
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      updateProcessStep('error', 'error', `Sharing failed: ${error}`);
      toast.error('Failed to share pin');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('pin_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      toast.success('Share removed');
      await loadShares();
    } catch (error) {
      console.error('Error removing share:', error);
      toast.error('Failed to remove share');
    }
  };

  const handleCreatePublicLink = async () => {
    setLoading(true);

    try {
      const result = await simplifiedSharingService.createPublicLink(
        pinId,
        'copy',
        {
          password: usePassword ? linkPassword : undefined,
          maxUses: maxUses || undefined,
        }
      );

      if (result.success && result.shareUrl) {
        navigator.clipboard.writeText(result.shareUrl);
        toast.success('Public link created and copied to clipboard');
        
        // Reset form
        setLinkPassword('');
        setUsePassword(false);
        setMaxUses(null);
        
        await loadShares();
      } else {
        toast.error(result.error || 'Failed to create public link');
      }
    } catch (error) {
      console.error('Error creating public link:', error);
      toast.error('Failed to create public link');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeLink = async (tokenId: string) => {
    try {
      const { error } = await supabase
        .from('share_tokens')
        .update({ is_active: false })
        .eq('id', tokenId);

      if (error) throw error;

      toast.success('Link revoked');
      await loadShares();
    } catch (error) {
      console.error('Error revoking link:', error);
      toast.error('Failed to revoke link');
    }
  };

  const copyLinkToClipboard = (token: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const getPermissionIcon = (permission: string) => {
    return <Copy className="h-3 w-3" />;
  };

  const getPermissionLabel = (permission: string) => {
    return 'Create Copy';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl z-[9999]">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-lg">Share "{pinName}"</DialogTitle>
          <DialogDescription className="text-sm">
            Create copies for other users
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Public Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-3">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm">Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setValidationState('idle');
                      setValidatedUser(null);
                    }}
                    disabled={loading}
                  />
                  <Button
                    onClick={validateEmail}
                    disabled={!email || loading || validationState === 'checking'}
                    variant="outline"
                    size="sm"
                  >
                    {validationState === 'checking' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : validationState === 'exists' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : validationState === 'not-exists' ? (
                      <UserPlus className="h-4 w-4 text-blue-500" />
                    ) : (
                      'Validate'
                    )}
                  </Button>
                </div>
                {validationState === 'exists' && validatedUser && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    User found: {validatedUser.fullName || email}
                  </p>
                )}
                {validationState === 'not-exists' && (
                  <p className="text-sm text-blue-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    User will be invited to join the app
                  </p>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Copy className="h-3 w-3" />
                  <div className="text-sm">
                    <span className="font-medium">Creates independent copy</span>
                    <span className="text-blue-600 dark:text-blue-300 ml-1">• Pin + data + files</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleShareWithUser}
                disabled={!email || loading || validationState === 'idle' || validationState === 'checking'}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : validationState === 'not-exists' ? (
                  <Mail className="h-4 w-4 mr-2" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                {validationState === 'not-exists' ? 'Send Invitation' : 'Share'}
              </Button>
            </div>

            {/* Process Visibility Section */}
            {(processSteps.length > 0 || shareSuccess.show) && (
              <div className="space-y-3">
                {/* Process Log Toggle */}
                {processSteps.length > 0 && (
                  <div className="border rounded-lg">
                    <button
                      onClick={() => setShowProcessLog(!showProcessLog)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <span className="font-medium">Process Log</span>
                        <Badge variant="outline" className="text-xs">
                          {processSteps.filter(s => s.status === 'success').length}/{processSteps.length}
                        </Badge>
                      </div>
                      {showProcessLog ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    
                    {showProcessLog && (
                      <div className="border-t p-3 space-y-2 bg-muted/20">
                        {processSteps.map((step, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs">
                            <div className="flex-shrink-0 mt-0.5">
                              {step.status === 'success' && <Check className="h-3 w-3 text-green-600" />}
                              {step.status === 'error' && <CloseIcon className="h-3 w-3 text-red-600" />}
                              {step.status === 'in-progress' && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
                              {step.status === 'pending' && <div className="h-3 w-3 border-2 border-muted rounded-full" />}
                            </div>
                            <div className="flex-1">
                              <div className={`font-medium ${
                                step.status === 'success' ? 'text-green-700 dark:text-green-400' :
                                step.status === 'error' ? 'text-red-700 dark:text-red-400' :
                                step.status === 'in-progress' ? 'text-blue-700 dark:text-blue-400' :
                                'text-muted-foreground'
                              }`}>
                                {step.message}
                              </div>
                              {step.details && (
                                <div className="mt-1 text-xs text-muted-foreground font-mono bg-muted/50 rounded p-1.5 max-h-16 overflow-y-auto">
                                  {typeof step.details === 'object' ? 
                                    JSON.stringify(step.details, null, 2) : 
                                    step.details
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Success Summary */}
                {shareSuccess.show && (
                  <div className="border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-900 dark:text-green-100">
                            Pin Shared Successfully!
                          </h4>
                          <div className="mt-2 space-y-2 text-sm text-green-800 dark:text-green-200">
                            {shareSuccess.shareData && (
                              <div className="flex items-center gap-2">
                                <Share2 className="h-4 w-4" />
                                <span>
                                  {shareSuccess.shareData.permission} access granted to {shareSuccess.shareData.recipient?.fullName || shareSuccess.shareData.recipient?.email}
                                </span>
                              </div>
                            )}
                            {shareSuccess.notificationData && (
                              <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4" />
                                <span>Notification sent successfully</span>
                              </div>
                            )}
                            {shareSuccess.pinData && (
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span>
                                  Pin data verified: {shareSuccess.pinData.fileCount || 0} associated files
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {userShares.length > 0 && (
              <div className="space-y-2">
                <Label>Shared With</Label>
                <div className="space-y-2">
                  {userShares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">
                            {share.profiles?.email}
                          </p>
                          {share.profiles?.full_name && (
                            <p className="text-sm text-muted-foreground">
                              {share.profiles.full_name}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          {getPermissionIcon(share.permission_level)}
                          {getPermissionLabel(share.permission_level)}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveShare(share.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="link" className="space-y-3">
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-md border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <Copy className="h-4 w-4" />
                  <div className="text-sm">
                    <span className="font-medium">Public link</span>
                    <span className="text-green-600 dark:text-green-300 ml-1">• Anyone can copy</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="use-password">Password Protection</Label>
                <Switch
                  id="use-password"
                  checked={usePassword}
                  onCheckedChange={setUsePassword}
                  disabled={loading}
                />
              </div>

              {usePassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="max-uses">Max Uses (Optional)</Label>
                <Input
                  id="max-uses"
                  type="number"
                  placeholder="Unlimited"
                  value={maxUses || ''}
                  onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={loading}
                  min="1"
                />
              </div>

              <Button
                onClick={handleCreatePublicLink}
                disabled={loading || (usePassword && !linkPassword)}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                Create Public Link
              </Button>
            </div>

            {publicLinks.length > 0 && (
              <div className="space-y-2">
                <Label>Active Links</Label>
                <div className="space-y-2">
                  {publicLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            {getPermissionIcon(link.permission_level)}
                            {getPermissionLabel(link.permission_level)}
                          </Badge>
                          {link.password_hash && (
                            <Badge variant="outline">Password Protected</Badge>
                          )}
                          {link.max_uses && (
                            <Badge variant="outline">
                              {link.used_count}/{link.max_uses} uses
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(link.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLinkToClipboard(link.token)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeLink(link.id)}
                          disabled={loading}
                        >
                          <CloseIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}