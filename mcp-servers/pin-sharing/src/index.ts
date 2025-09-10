import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Use service key for admin operations
);

// Types
interface SharePinParams {
  pinId: string;
  sharedWithEmail?: string;
  permission: 'view' | 'edit' | 'admin';
  expiresIn?: number; // Hours until expiration
}

interface CreatePublicLinkParams {
  pinId?: string;
  projectId?: string;
  permission: 'view' | 'edit';
  password?: string;
  maxUses?: number;
  expiresIn?: number; // Hours until expiration
}

interface RevokeShareParams {
  shareId?: string;
  tokenId?: string;
  pinId?: string;
  sharedWithEmail?: string;
}

// MCP Server setup
const server = new Server(
  {
    name: 'mcp-pin-sharing',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper functions
async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .single();
  
  if (error || !data) {
    // Try auth.users table as fallback
    const { data: users, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;
    
    const user = users.users.find(u => u.email === email);
    if (!user) throw new Error(`User with email ${email} not found`);
    
    return { id: user.id, email: user.email };
  }
  
  return data;
}

async function generateShareToken(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_share_token');
  if (error) throw error;
  return data;
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'share_pin',
      description: 'Share a pin with another user by email',
      inputSchema: {
        type: 'object',
        properties: {
          pinId: { type: 'string', description: 'ID of the pin to share' },
          sharedWithEmail: { type: 'string', description: 'Email of user to share with' },
          permission: { 
            type: 'string', 
            enum: ['view', 'edit', 'admin'],
            description: 'Permission level for the share' 
          },
          expiresIn: { 
            type: 'number', 
            description: 'Hours until share expires (optional)' 
          }
        },
        required: ['pinId', 'sharedWithEmail', 'permission']
      }
    },
    {
      name: 'create_public_link',
      description: 'Create a public shareable link for a pin or project',
      inputSchema: {
        type: 'object',
        properties: {
          pinId: { type: 'string', description: 'ID of the pin to share (either pinId or projectId required)' },
          projectId: { type: 'string', description: 'ID of the project to share' },
          permission: { 
            type: 'string', 
            enum: ['view', 'edit'],
            description: 'Permission level for public access' 
          },
          password: { type: 'string', description: 'Optional password protection' },
          maxUses: { type: 'number', description: 'Maximum number of uses for the link' },
          expiresIn: { type: 'number', description: 'Hours until link expires' }
        },
        required: ['permission']
      }
    },
    {
      name: 'revoke_share',
      description: 'Revoke a share or public link',
      inputSchema: {
        type: 'object',
        properties: {
          shareId: { type: 'string', description: 'ID of the pin_share to revoke' },
          tokenId: { type: 'string', description: 'ID of the share_token to revoke' },
          pinId: { type: 'string', description: 'Revoke all shares for this pin' },
          sharedWithEmail: { type: 'string', description: 'Revoke all shares with this user' }
        }
      }
    },
    {
      name: 'list_shares',
      description: 'List all shares for a pin or by a user',
      inputSchema: {
        type: 'object',
        properties: {
          pinId: { type: 'string', description: 'List shares for this pin' },
          projectId: { type: 'string', description: 'List shares for this project' },
          userId: { type: 'string', description: 'List shares created by this user' }
        }
      }
    },
    {
      name: 'validate_token',
      description: 'Validate a public share token',
      inputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'The share token to validate' },
          password: { type: 'string', description: 'Password if token is password-protected' }
        },
        required: ['token']
      }
    },
    {
      name: 'get_shared_with_me',
      description: 'Get all pins/projects shared with the current user',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID to get shares for' }
        },
        required: ['userId']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'share_pin': {
        const params = args as SharePinParams;
        
        // Get the user to share with
        const sharedUser = await getUserByEmail(params.sharedWithEmail!);
        
        // Calculate expiration
        const expiresAt = params.expiresIn 
          ? new Date(Date.now() + params.expiresIn * 60 * 60 * 1000).toISOString()
          : null;
        
        // Get pin owner (from current session/context)
        const { data: { user: owner } } = await supabase.auth.getUser();
        if (!owner) throw new Error('Authentication required');
        
        // Create the share
        const { data, error } = await supabase
          .from('pin_shares')
          .insert({
            pin_id: params.pinId,
            owner_id: owner.id,
            shared_with_id: sharedUser.id,
            permission: params.permission,
            expires_at: expiresAt
          })
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                shareId: data.id,
                message: `Pin shared with ${params.sharedWithEmail} with ${params.permission} permission`
              }, null, 2)
            }
          ]
        };
      }

      case 'create_public_link': {
        const params = args as CreatePublicLinkParams;
        
        // Validate that either pinId or projectId is provided
        if (!params.pinId && !params.projectId) {
          throw new Error('Either pinId or projectId must be provided');
        }
        
        // Get current user
        const { data: { user: owner } } = await supabase.auth.getUser();
        if (!owner) throw new Error('Authentication required');
        
        // Generate token
        const token = await generateShareToken();
        
        // Hash password if provided
        const passwordHash = params.password 
          ? await bcrypt.hash(params.password, 10)
          : null;
        
        // Calculate expiration
        const expiresAt = params.expiresIn 
          ? new Date(Date.now() + params.expiresIn * 60 * 60 * 1000).toISOString()
          : null;
        
        // Create share token
        const { data, error } = await supabase
          .from('share_tokens')
          .insert({
            token,
            pin_id: params.pinId || null,
            project_id: params.projectId || null,
            owner_id: owner.id,
            permission: params.permission,
            password_hash: passwordHash,
            max_uses: params.maxUses || null,
            expires_at: expiresAt
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Construct the shareable URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
        const shareUrl = `${baseUrl}/shared/${token}`;
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                tokenId: data.id,
                token: token,
                shareUrl,
                expiresAt,
                passwordProtected: !!params.password,
                maxUses: params.maxUses
              }, null, 2)
            }
          ]
        };
      }

      case 'revoke_share': {
        const params = args as RevokeShareParams;
        
        // Get current user
        const { data: { user: owner } } = await supabase.auth.getUser();
        if (!owner) throw new Error('Authentication required');
        
        let result: any = { success: false };
        
        if (params.shareId) {
          // Revoke specific pin share
          const { error } = await supabase
            .from('pin_shares')
            .delete()
            .eq('id', params.shareId)
            .eq('owner_id', owner.id);
          
          if (error) throw error;
          result = { success: true, message: 'Share revoked successfully' };
        } else if (params.tokenId) {
          // Revoke specific token
          const { error } = await supabase
            .from('share_tokens')
            .update({ is_active: false })
            .eq('id', params.tokenId)
            .eq('owner_id', owner.id);
          
          if (error) throw error;
          result = { success: true, message: 'Public link revoked successfully' };
        } else if (params.pinId && params.sharedWithEmail) {
          // Revoke share for specific user on specific pin
          const sharedUser = await getUserByEmail(params.sharedWithEmail);
          
          const { error } = await supabase
            .from('pin_shares')
            .delete()
            .eq('pin_id', params.pinId)
            .eq('shared_with_id', sharedUser.id)
            .eq('owner_id', owner.id);
          
          if (error) throw error;
          result = { success: true, message: `Share with ${params.sharedWithEmail} revoked` };
        } else if (params.pinId) {
          // Revoke all shares for a pin
          const { error: shareError } = await supabase
            .from('pin_shares')
            .delete()
            .eq('pin_id', params.pinId)
            .eq('owner_id', owner.id);
          
          const { error: tokenError } = await supabase
            .from('share_tokens')
            .update({ is_active: false })
            .eq('pin_id', params.pinId)
            .eq('owner_id', owner.id);
          
          if (shareError || tokenError) throw shareError || tokenError;
          result = { success: true, message: 'All shares for pin revoked' };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'list_shares': {
        const params = args as any;
        
        // Get current user
        const { data: { user: owner } } = await supabase.auth.getUser();
        if (!owner) throw new Error('Authentication required');
        
        let pinShares: any[] = [];
        let shareTokens: any[] = [];
        
        if (params.pinId) {
          // Get all shares for a pin
          const { data: shares } = await supabase
            .from('pin_shares')
            .select(`
              *,
              shared_with:auth.users!shared_with_id(email)
            `)
            .eq('pin_id', params.pinId)
            .eq('owner_id', owner.id);
          
          const { data: tokens } = await supabase
            .from('share_tokens')
            .select('*')
            .eq('pin_id', params.pinId)
            .eq('owner_id', owner.id)
            .eq('is_active', true);
          
          pinShares = shares || [];
          shareTokens = tokens || [];
        } else if (params.projectId) {
          // Get all shares for a project
          const { data: tokens } = await supabase
            .from('share_tokens')
            .select('*')
            .eq('project_id', params.projectId)
            .eq('owner_id', owner.id)
            .eq('is_active', true);
          
          shareTokens = tokens || [];
        } else if (params.userId) {
          // Get all shares created by a user
          const { data: shares } = await supabase
            .from('pin_shares')
            .select(`
              *,
              pin:pins!pin_id(label, lat, lng),
              shared_with:auth.users!shared_with_id(email)
            `)
            .eq('owner_id', params.userId);
          
          const { data: tokens } = await supabase
            .from('share_tokens')
            .select(`
              *,
              pin:pins!pin_id(label, lat, lng),
              project:projects!project_id(name)
            `)
            .eq('owner_id', params.userId)
            .eq('is_active', true);
          
          pinShares = shares || [];
          shareTokens = tokens || [];
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                pinShares,
                publicLinks: shareTokens,
                totalShares: pinShares.length + shareTokens.length
              }, null, 2)
            }
          ]
        };
      }

      case 'validate_token': {
        const params = args as any;
        
        // Get token details
        const { data: token, error } = await supabase
          .from('share_tokens')
          .select(`
            *,
            pin:pins!pin_id(*, user:auth.users!user_id(email)),
            project:projects!project_id(*, user:auth.users!user_id(email))
          `)
          .eq('token', params.token)
          .eq('is_active', true)
          .single();
        
        if (error || !token) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  valid: false,
                  error: 'Invalid or expired token'
                }, null, 2)
              }
            ]
          };
        }
        
        // Check expiration
        if (token.expires_at && new Date(token.expires_at) < new Date()) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  valid: false,
                  error: 'Token has expired'
                }, null, 2)
              }
            ]
          };
        }
        
        // Check max uses
        if (token.max_uses && token.used_count >= token.max_uses) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  valid: false,
                  error: 'Token has reached maximum uses'
                }, null, 2)
              }
            ]
          };
        }
        
        // Verify password if protected
        if (token.password_hash) {
          if (!params.password) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    valid: false,
                    passwordRequired: true,
                    error: 'Password required'
                  }, null, 2)
                }
              ]
            };
          }
          
          const passwordValid = await bcrypt.compare(params.password, token.password_hash);
          if (!passwordValid) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    valid: false,
                    error: 'Invalid password'
                  }, null, 2)
                }
              ]
            };
          }
        }
        
        // Update usage count
        await supabase
          .from('share_tokens')
          .update({ 
            used_count: token.used_count + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', token.id);
        
        // Log analytics
        await supabase
          .from('share_analytics')
          .insert({
            share_token_id: token.id,
            action: 'validate',
            accessed_at: new Date().toISOString()
          });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                valid: true,
                tokenId: token.id,
                permission: token.permission,
                pin: token.pin,
                project: token.project,
                remainingUses: token.max_uses ? token.max_uses - token.used_count - 1 : null
              }, null, 2)
            }
          ]
        };
      }

      case 'get_shared_with_me': {
        const params = args as any;
        
        // Get pins shared with the user
        const { data: sharedPins } = await supabase
          .from('pin_shares')
          .select(`
            *,
            pin:pins!pin_id(*),
            owner:auth.users!owner_id(email)
          `)
          .eq('shared_with_id', params.userId)
          .is('expires_at', null)
          .or(`expires_at.gt.${new Date().toISOString()}`);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                sharedPins: sharedPins || [],
                totalShared: sharedPins?.length || 0
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool ${name} not found`
        );
    }
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      error.message || 'An error occurred'
    );
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Pin Sharing Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});