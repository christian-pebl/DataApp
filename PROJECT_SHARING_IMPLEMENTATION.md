# 🤝 Project Sharing Feature - Implementation Guide

**Status:** Database Ready, Backend & UI Pending
**Last Updated:** October 29, 2025
**Priority:** High

---

## 📋 QUICK START FOR TOMORROW

### **What You Need to Do:**

1. **Apply the database migration** (5 minutes)
   - Go to: https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/sql/new
   - Copy migration: `cat supabase/migrations/20251029_project_sharing.sql | clip`
   - Paste and click **RUN**
   - Mark as applied: `npx supabase migration repair --status applied 20251029`

2. **Start development server** (if not already running)
   ```bash
   npm run dev
   ```

3. **Continue with backend implementation** (see below)

---

## 🎯 FEATURE OVERVIEW

### **What We're Building:**
A multi-user project collaboration system where:
- Project **owners** can share projects with other users
- **Three permission levels:** View, Edit, Admin
- Shared users see all project data (pins, lines, areas, files)
- Data ownership tracked per user
- Invitation-based access control

### **Test Accounts:**
- **Owner/Admin:** christian@pebl-cic.co.uk
- **Test User:** peblapp9@gmail.com

---

## ✅ COMPLETED SO FAR

### **1. Database Schema Created** ✅
**File:** `supabase/migrations/20251029_project_sharing.sql`

**New Tables:**
- `project_shares` - Tracks who has access to which projects
- `project_invitations` - Pending invitations with tokens
- Added `created_by` column to `pin_files` - Track file uploaders

**New Functions:**
- `has_project_access(project_id, user_id)` - Check if user can access project
- `get_project_permission(project_id, user_id)` - Get user's permission level

**Updated RLS Policies:** All tables now support multi-user access
- `projects` - View own or shared projects
- `pins`, `lines`, `areas`, `tags` - Access based on project permission
- `pin_files` - Upload/view based on project permission

### **2. Permission Model Defined** ✅

| Permission | View | Edit Objects | Upload Files | Share Project | Delete Project |
|------------|------|--------------|--------------|---------------|----------------|
| **View**   | ✅   | ❌           | ❌           | ❌            | ❌             |
| **Edit**   | ✅   | ✅           | ✅           | ❌            | ❌             |
| **Admin**  | ✅   | ✅           | ✅           | ✅            | ❌             |
| **Owner**  | ✅   | ✅           | ✅           | ✅            | ✅             |

### **3. Migration Strategy Learned** ✅

**Why Supabase CLI was difficult:**
- Legacy migrations had duplicate timestamps
- Mixed management (dashboard + CLI)
- Old migrations referenced deleted columns

**Solution for this time:**
- Apply migration manually via Supabase Dashboard
- Mark as applied in CLI
- Future migrations will work cleanly via CLI

---

## 🚧 TODO: NEXT STEPS

### **Phase 1: Apply Database Migration** (5 min)
**Status:** Ready to apply

**Steps:**
1. Open Supabase SQL Editor
2. Copy migration SQL from: `supabase/migrations/20251029_project_sharing.sql`
3. Paste and RUN
4. Verify success (no errors)
5. Mark as applied:
   ```bash
   npx supabase migration repair --status applied 20251029
   ```

---

### **Phase 2: Backend Services** (2-3 hours)

#### **2.1 Create `project-sharing-service.ts`**
**Location:** `src/lib/supabase/project-sharing-service.ts`

**Functions needed:**
```typescript
// Share with existing user
shareProject(projectId, userId, permissionLevel): Promise<ShareResult>

// Invite via email (creates invitation token)
inviteToProject(projectId, email, permissionLevel): Promise<InvitationResult>

// List all users with access
getProjectShares(projectId): Promise<ProjectShare[]>

// Remove access
removeProjectShare(projectId, userId): Promise<void>

// Change permission level
updateProjectSharePermission(projectId, userId, newPermission): Promise<void>

// Accept invitation (when user clicks link)
acceptProjectInvitation(token): Promise<AcceptResult>

// Get projects shared with current user
getSharedProjects(): Promise<Project[]>

// Check current user's permission on project
getMyProjectPermission(projectId): Promise<'owner' | 'admin' | 'edit' | 'view' | null>
```

**Template to start with:**
```typescript
import { createClient } from './client';

export interface ProjectShare {
  id: string;
  projectId: string;
  userId: string;
  userEmail: string;
  permissionLevel: 'view' | 'edit' | 'admin';
  sharedBy: string;
  createdAt: Date;
}

export interface InvitationResult {
  success: boolean;
  invitationId?: string;
  invitationToken?: string;
  error?: string;
}

class ProjectSharingService {
  private supabase = createClient();

  async shareProject(
    projectId: string,
    userId: string,
    permissionLevel: 'view' | 'edit' | 'admin'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await this.supabase
        .from('project_shares')
        .insert({
          project_id: projectId,
          user_id: userId,
          permission_level: permissionLevel,
          shared_by: user.id,
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // TODO: Implement remaining methods...
}

export const projectSharingService = new ProjectSharingService();
```

#### **2.2 Update `project-service.ts`**
**Location:** `src/lib/supabase/project-service.ts`

**Changes needed:**
```typescript
// Modify getProjects() to include shared projects
async getProjects(): Promise<Project[]> {
  const { data: { user } } = await this.supabase.auth.getUser();
  if (!user) return [];

  // Get own projects AND shared projects
  const { data, error } = await this.supabase
    .from('projects')
    .select(`
      *,
      project_shares!inner(permission_level)
    `)
    .or(`user_id.eq.${user.id},project_shares.user_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(project => ({
    id: project.id,
    name: project.name,
    description: project.description || undefined,
    createdAt: new Date(project.created_at),
    isOwner: project.user_id === user.id,
    permission: project.user_id === user.id
      ? 'owner'
      : project.project_shares?.[0]?.permission_level,
  }));
}
```

**Add helper method:**
```typescript
async checkProjectPermission(
  projectId: string
): Promise<'owner' | 'admin' | 'edit' | 'view' | null> {
  const { data: { user } } = await this.supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await this.supabase
    .rpc('get_project_permission', {
      check_project_id: projectId,
      check_user_id: user.id
    });

  if (error) return null;
  return data;
}
```

---

### **Phase 3: UI Components** (3-4 hours)

#### **3.1 Update Project Settings Dialog**
**Location:** `src/app/map-drawing/page.tsx:7883-7894`

**Add Share Section:**
```tsx
{/* After Project Name section */}
<div className="space-y-2">
  <label className="text-sm font-medium">Share Project</label>
  <div className="flex gap-2">
    <Button
      onClick={() => setShowProjectSharingDialog(true)}
      className="flex items-center gap-2"
    >
      <Users className="h-4 w-4" />
      Manage Sharing
    </Button>
    {projectPermission === 'owner' || projectPermission === 'admin' ? (
      <Badge variant="secondary">You can share</Badge>
    ) : (
      <Badge variant="outline">Shared with you</Badge>
    )}
  </div>
</div>
```

#### **3.2 Create `ProjectSharingDialog` Component**
**Location:** `src/components/project/ProjectSharingDialog.tsx`

**Features to implement:**
- Input field for email address
- Dropdown for permission level (View / Edit / Admin)
- "Send Invitation" button
- List of current users with access
- Ability to change permissions
- Ability to remove access
- Show current user's permission
- Visual badges for Owner, Admin, Edit, View

**Component structure:**
```tsx
'use client'

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Mail, Shield, Edit, Eye, Trash2 } from 'lucide-react';

interface ProjectSharingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function ProjectSharingDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ProjectSharingDialogProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<'view' | 'edit' | 'admin'>('edit');
  const [shares, setShares] = useState<ProjectShare[]>([]);

  // TODO: Load shares on mount
  // TODO: Implement invite handler
  // TODO: Implement remove handler
  // TODO: Implement permission change handler

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share "{projectName}"
          </DialogTitle>
        </DialogHeader>

        {/* Invite Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Invite User</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Select value={permissionLevel} onValueChange={setPermissionLevel}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite}>
                <Mail className="h-4 w-4 mr-2" />
                Invite
              </Button>
            </div>
          </div>

          {/* Current Users List */}
          <div className="space-y-2">
            <label className="text-sm font-medium">People with access</label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shares.map((share) => (
                <div key={share.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{share.userEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited by {share.sharedBy}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      share.permissionLevel === 'admin' ? 'default' :
                      share.permissionLevel === 'edit' ? 'secondary' : 'outline'
                    }>
                      {share.permissionLevel}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(share.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### **3.3 Add Permission Badges to Project List**
**Location:** `src/app/map-drawing/page.tsx` (in project selector)

**Show badge indicating:**
- "Owner" - You own this project
- "Shared with you (View)" - Read-only
- "Shared with you (Edit)" - Can edit
- "Shared with you (Admin)" - Can share

#### **3.4 Add Permission Checks**
**Before edit/delete operations, check permission:**
```typescript
const canEdit = ['owner', 'admin', 'edit'].includes(projectPermission);
const canDelete = projectPermission === 'owner';
const canShare = ['owner', 'admin'].includes(projectPermission);

// Disable buttons based on permission
<Button disabled={!canEdit} onClick={handleEdit}>Edit</Button>
<Button disabled={!canDelete} onClick={handleDelete}>Delete</Button>
```

---

### **Phase 4: Testing** (1-2 hours)

#### **Test Plan:**

**4.1 Database Test (Manual)**
```sql
-- Verify tables exist
SELECT * FROM project_shares LIMIT 1;
SELECT * FROM project_invitations LIMIT 1;

-- Test helper function
SELECT has_project_access('YOUR_PROJECT_ID', 'YOUR_USER_ID');
SELECT get_project_permission('YOUR_PROJECT_ID', 'YOUR_USER_ID');
```

**4.2 Backend Test (Create test file)**
**Location:** `src/lib/__tests__/project-sharing.test.ts`
- Test shareProject()
- Test inviteToProject()
- Test getProjectShares()
- Test permission checks

**4.3 UI Test (Playwright)**
**Test as christian@pebl-cic.co.uk:**
1. Login
2. Go to map-drawing
3. Click project settings cog
4. Click "Manage Sharing"
5. Invite peblapp9@gmail.com with "Edit" permission
6. Verify invitation created

**Test as peblapp9@gmail.com:**
1. Login
2. Check if shared project appears in list
3. Open shared project
4. Verify can see all data
5. Try to edit (should work)
6. Try to delete project (should fail)

**4.4 Permission Test Matrix:**
| Action | Owner | Admin | Edit | View |
|--------|-------|-------|------|------|
| View data | ✅ | ✅ | ✅ | ✅ |
| Create pin | ✅ | ✅ | ✅ | ❌ |
| Edit pin | ✅ | ✅ | ✅ | ❌ |
| Delete pin | ✅ | ✅ | ✅ | ❌ |
| Upload file | ✅ | ✅ | ✅ | ❌ |
| Share project | ✅ | ✅ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ | ❌ |

---

## 📁 FILES CREATED/MODIFIED

### **Created:**
- `supabase/migrations/20251029_project_sharing.sql` - Database migration
- `PROJECT_SHARING_IMPLEMENTATION.md` - This file

### **To Create:**
- `src/lib/supabase/project-sharing-service.ts` - Backend service
- `src/components/project/ProjectSharingDialog.tsx` - UI component
- `src/lib/__tests__/project-sharing.test.ts` - Tests

### **To Modify:**
- `src/lib/supabase/project-service.ts` - Add shared project support
- `src/lib/supabase/types.ts` - Add ProjectShare types
- `src/app/map-drawing/page.tsx` - Add sharing UI to project settings

---

## 🔧 TECHNICAL DETAILS

### **Database Schema:**

**project_shares table:**
```sql
- id: UUID (primary key)
- project_id: UUID (foreign key to projects)
- user_id: UUID (foreign key to auth.users)
- permission_level: 'view' | 'edit' | 'admin'
- shared_by: UUID (foreign key to auth.users)
- created_at: timestamp
- updated_at: timestamp
- UNIQUE(project_id, user_id)
```

**project_invitations table:**
```sql
- id: UUID (primary key)
- project_id: UUID (foreign key to projects)
- inviter_id: UUID (foreign key to auth.users)
- invitee_email: text
- permission_level: 'view' | 'edit' | 'admin'
- invitation_token: text (unique, auto-generated)
- status: 'pending' | 'accepted' | 'rejected' | 'expired'
- created_at: timestamp
- expires_at: timestamp (7 days from creation)
- UNIQUE(project_id, invitee_email)
```

### **RLS Policy Pattern:**

All data tables use this pattern:
```sql
-- View if owner OR has project access
USING (
  user_id = auth.uid()
  OR (project_id IS NOT NULL AND has_project_access(project_id, auth.uid()))
)

-- Edit if owner OR has edit/admin permission
USING (
  user_id = auth.uid()
  OR (
    project_id IS NOT NULL
    AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
  )
)
```

---

## 🐛 KNOWN ISSUES / NOTES

1. **Migration CLI Issue:** Legacy migrations cause conflicts. Solution: Apply manually, mark as applied.

2. **Invitation Expiration:** Invitations expire after 7 days. Need cleanup job or UI to resend.

3. **Email Service:** Email sending for invitations not yet implemented (from CLAUDE.md TODO #2).

4. **Real-time Updates:** When one user edits, other users won't see changes until refresh. Consider adding Supabase real-time subscriptions later.

5. **File Ownership:** `created_by` column added but not yet populated. Need to set on file upload.

---

## 🚀 QUICK COMMANDS

### **Development:**
```bash
# Start dev server
npm run dev

# Run tests
npm test

# Check types
npm run type-check
```

### **Database:**
```bash
# Pull current schema
npx supabase db pull --linked

# Check migration status
npx supabase migration list --linked

# Mark migration as applied
npx supabase migration repair --status applied 20251029

# Push future migrations
npx supabase db push --linked
```

### **Supabase:**
- **SQL Editor:** https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/sql/new
- **Auth Users:** https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/auth/users
- **Database Tables:** https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/editor

---

## 📞 SUPPORT RESOURCES

- **Supabase RLS Docs:** https://supabase.com/docs/guides/auth/row-level-security
- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Next.js SSR with Supabase:** https://supabase.com/docs/guides/auth/auth-helpers/nextjs

---

## ✅ TOMORROW'S CHECKLIST

- [ ] 1. Apply database migration (5 min)
- [ ] 2. Create `project-sharing-service.ts` (1 hour)
- [ ] 3. Update `project-service.ts` for shared projects (30 min)
- [ ] 4. Add Share button to Project Settings (15 min)
- [ ] 5. Create `ProjectSharingDialog` component (2 hours)
- [ ] 6. Add permission checks and badges (30 min)
- [ ] 7. Test with both accounts (30 min)
- [ ] 8. Fix any bugs found (1 hour buffer)

**Total Estimated Time:** 5-6 hours

---

## 🎯 SUCCESS CRITERIA

The feature is complete when:
1. ✅ Database migration applied successfully
2. ✅ christian@pebl-cic.co.uk can share project with peblapp9@gmail.com
3. ✅ peblapp9@gmail.com sees shared project in their project list
4. ✅ peblapp9@gmail.com can view all project data
5. ✅ peblapp9@gmail.com can edit data (if Edit permission)
6. ✅ peblapp9@gmail.com CANNOT delete project (only owner can)
7. ✅ Permission levels work as defined in matrix
8. ✅ UI shows permission badges correctly
9. ✅ No errors in browser console
10. ✅ No errors in terminal

---

**Last Updated:** October 29, 2025
**Status:** Database Ready, Resume with Backend Implementation
**Next Session:** Apply migration → Build backend → Build UI → Test
