'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  Link,
  Copy,
  Trash2,
  Shield,
  Clock,
  Eye,
  Edit,
  UserCog,
  Loader2,
  Mail,
} from 'lucide-react';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinId: string;
  pinLabel: string;
}

interface PinShare {
  id: string;
  shared_with_id: string;
  permission: 'view' | 'edit' | 'admin';
  shared_at: string;
  expires_at?: string;
  shared_with?: {
    email: string;
  };
}

interface ShareToken {
  id: string;
  token: string;
  permission: 'view' | 'edit';
  is_active: boolean;
  max_uses?: number;
  used_count: number;
  expires_at?: string;
  password_hash?: string;
  created_at: string;
}

export function ShareDialog({ open, onOpenChange, pinId, pinLabel }: ShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const supabase = createClient();

  // User sharing state
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit' | 'admin'>('view');
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [userShares, setUserShares] = useState<PinShare[]>([]);

  // Public link state
  const [linkPermission, setLinkPermission] = useState<'view' | 'edit'>('view');
  const [linkPassword, setLinkPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [linkExpiresIn, setLinkExpiresIn] = useState<number | null>(null);
  const [publicLinks, setPublicLinks] = useState<ShareToken[]>([]);

  // Load existing shares when dialog opens
  useEffect(() => {
    if (open) {
      loadShares();
    }
  }, [open, pinId]);

  const loadShares = async () => {
    try {
      // Load user shares
      const { data: shares } = await supabase
        .from('pin_shares')
        .select(`
          *,
          shared_with:profiles!shared_with_id(email)
        `)
        .eq('pin_id', pinId);

      if (shares) {
        setUserShares(shares as any);
      }

      // Load public links
      const { data: tokens } = await supabase
        .from('share_tokens')
        .select('*')
        .eq('pin_id', pinId)
        .eq('is_active', true);

      if (tokens) {
        setPublicLinks(tokens);
      }
    } catch (error) {
      console.error('Error loading shares:', error);
    }
  };

  const handleShareWithUser = async () => {
    if (!email) {
      toast('Please enter an email address', {
        description: 'Email is required to share with a user.',
      });
      return;
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find user by email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (!profiles) {
        toast('User not found. They need to sign up first.', {
          description: 'The user must have an account to receive shares.',
        });
        setLoading(false);
        return;
      }

      // Calculate expiration
      const expires_at = expiresIn
        ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create share
      const { error } = await supabase
        .from('pin_shares')
        .insert({
          pin_id: pinId,
          owner_id: user.id,
          shared_with_id: profiles.id,
          permission,
          expires_at,
        });

      if (error) throw error;

      toast(`Pin shared with ${email}`, {
        description: 'The user will be notified of the share.',
      });
      setEmail('');
      loadShares();
    } catch (error: any) {
      console.error('Share error:', error);
      toast('Failed to share pin', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePublicLink = async () => {
    console.log('Creating public link for pin:', pinId);
    setLoading(true);
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Auth error:', authError);
        throw new Error('Authentication failed: ' + authError.message);
      }
      if (!user) throw new Error('Not authenticated');
      console.log('User authenticated:', user.id);

      // Generate token
      const token = btoa(Math.random().toString(36).substring(2, 15) + Date.now());
      console.log('Generated token:', token.substring(0, 10) + '...');

      // Calculate expiration
      const expires_at = linkExpiresIn
        ? new Date(Date.now() + linkExpiresIn * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Hash password if needed
      let password_hash = null;
      if (usePassword && linkPassword) {
        // Simple hash for demo - in production use bcrypt
        password_hash = btoa(linkPassword);
      }

      // Create share token
      const shareData = {
        token,
        pin_id: pinId,
        owner_id: user.id,
        permission: linkPermission,
        password_hash,
        max_uses: maxUses,
        expires_at,
      };
      console.log('Inserting share token:', shareData);
      
      const { data, error } = await supabase
        .from('share_tokens')
        .insert(shareData)
        .select();

      if (error) {
        console.error('Database error creating share token:', error);
        throw error;
      }
      
      console.log('Share token created successfully:', data);

      // Copy link to clipboard
      const shareUrl = `${window.location.origin}/shared/${token}`;
      await navigator.clipboard.writeText(shareUrl);

      toast('Public link created and copied to clipboard', {
        description: shareUrl,
      });
      setLinkPassword('');
      setUsePassword(false);
      loadShares();
    } catch (error: any) {
      console.error('Public link error:', error);
      toast('Failed to create public link', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('pin_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;
      toast('Share revoked', {
        description: 'The user no longer has access to this pin.',
      });
      loadShares();
    } catch (error: any) {
      console.error('Revoke share error:', error);
      toast('Failed to revoke share', {
        description: error.message || 'Please try again.',
      });
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    try {
      const { error } = await supabase
        .from('share_tokens')
        .update({ is_active: false })
        .eq('id', tokenId);

      if (error) throw error;
      toast('Public link revoked', {
        description: 'The link is no longer active.',
      });
      loadShares();
    } catch (error: any) {
      console.error('Revoke link error:', error);
      toast('Failed to revoke link', {
        description: error.message || 'Please try again.',
      });
    }
  };

  const copyLink = async (token: string) => {
    const shareUrl = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(shareUrl);
    toast('Link copied to clipboard', {
      description: shareUrl,
    });
  };

  const getPermissionIcon = (perm: string) => {
    switch (perm) {
      case 'view':
        return <Eye className="h-3 w-3" />;
      case 'edit':
        return <Edit className="h-3 w-3" />;
      case 'admin':
        return <UserCog className="h-3 w-3" />;
      default:
        return <Shield className="h-3 w-3" />;
    }
  };

  const getPermissionColor = (perm: string) => {
    switch (perm) {
      case 'view':
        return 'default';
      case 'edit':
        return 'secondary';
      case 'admin':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share "{pinLabel}"</DialogTitle>
          <DialogDescription>
            Share this pin with other users or create a public link
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Share with Users
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link className="h-4 w-4 mr-2" />
              Public Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex space-x-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Mail className="h-5 w-5 text-muted-foreground self-center" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Permission Level</Label>
                  <Select value={permission} onValueChange={setPermission as any}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">
                        <div className="flex items-center">
                          <Eye className="h-4 w-4 mr-2" />
                          View Only
                        </div>
                      </SelectItem>
                      <SelectItem value="edit">
                        <div className="flex items-center">
                          <Edit className="h-4 w-4 mr-2" />
                          Can Edit
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center">
                          <UserCog className="h-4 w-4 mr-2" />
                          Admin
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Expires In (days)</Label>
                  <Input
                    type="number"
                    placeholder="Never"
                    value={expiresIn || ''}
                    onChange={(e) => setExpiresIn(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>

              <Button onClick={handleShareWithUser} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Share with User
              </Button>

              {userShares.length > 0 && (
                <div className="space-y-2">
                  <Label>Shared With</Label>
                  <div className="space-y-2">
                    {userShares.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center justify-between p-2 rounded-lg border"
                      >
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{share.shared_with?.email}</span>
                          <Badge variant={getPermissionColor(share.permission) as any}>
                            {getPermissionIcon(share.permission)}
                            <span className="ml-1">{share.permission}</span>
                          </Badge>
                          {share.expires_at && (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(share.expires_at).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokeShare(share.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Permission Level</Label>
                  <Select value={linkPermission} onValueChange={setLinkPermission as any}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">
                        <div className="flex items-center">
                          <Eye className="h-4 w-4 mr-2" />
                          View Only
                        </div>
                      </SelectItem>
                      <SelectItem value="edit">
                        <div className="flex items-center">
                          <Edit className="h-4 w-4 mr-2" />
                          Can Edit
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Uses</Label>
                  <Input
                    type="number"
                    placeholder="Unlimited"
                    value={maxUses || ''}
                    onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expires In (days)</Label>
                  <Input
                    type="number"
                    placeholder="Never"
                    value={linkExpiresIn || ''}
                    onChange={(e) => setLinkExpiresIn(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Password Protection</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={usePassword}
                      onCheckedChange={setUsePassword}
                    />
                    <span className="text-sm text-muted-foreground">
                      {usePassword ? 'Protected' : 'No password'}
                    </span>
                  </div>
                </div>
              </div>

              {usePassword && (
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                  />
                </div>
              )}

              <Button onClick={handleCreatePublicLink} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                Generate Public Link
              </Button>

              {publicLinks.length > 0 && (
                <div className="space-y-2">
                  <Label>Active Links</Label>
                  <div className="space-y-2">
                    {publicLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-2 rounded-lg border"
                      >
                        <div className="flex items-center space-x-2">
                          <Link className="h-4 w-4 text-muted-foreground" />
                          <code className="text-xs">{link.token.substring(0, 8)}...</code>
                          <Badge variant={getPermissionColor(link.permission) as any}>
                            {getPermissionIcon(link.permission)}
                            <span className="ml-1">{link.permission}</span>
                          </Badge>
                          {link.password_hash && (
                            <Badge variant="outline">
                              <Shield className="h-3 w-3" />
                            </Badge>
                          )}
                          {link.max_uses && (
                            <Badge variant="outline">
                              {link.used_count}/{link.max_uses}
                            </Badge>
                          )}
                          {link.expires_at && (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(link.expires_at).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyLink(link.token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevokeToken(link.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}