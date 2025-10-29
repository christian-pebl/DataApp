-- Project Sharing Feature Migration
-- Creates tables and policies for multi-user project collaboration

-- ============================================================================
-- 1. CREATE project_shares TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'edit', 'admin')),
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_user_id ON project_shares(user_id);

-- ============================================================================
-- 2. CREATE project_invitations TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'edit', 'admin')),
  invitation_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  UNIQUE(project_id, invitee_email)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(invitee_email);

-- ============================================================================
-- 3. ADD created_by COLUMN TO pin_files (track who uploaded files)
-- ============================================================================
ALTER TABLE pin_files ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- ============================================================================
-- 4. CREATE HELPER FUNCTION: Check if user has project access
-- ============================================================================
CREATE OR REPLACE FUNCTION has_project_access(
  check_project_id UUID,
  check_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- User is owner
    SELECT 1 FROM projects
    WHERE id = check_project_id AND user_id = check_user_id
  ) OR EXISTS (
    -- User has shared access
    SELECT 1 FROM project_shares
    WHERE project_id = check_project_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. CREATE HELPER FUNCTION: Get user's permission level
-- ============================================================================
CREATE OR REPLACE FUNCTION get_project_permission(
  check_project_id UUID,
  check_user_id UUID
) RETURNS TEXT AS $$
BEGIN
  -- Check if owner
  IF EXISTS (
    SELECT 1 FROM projects
    WHERE id = check_project_id AND user_id = check_user_id
  ) THEN
    RETURN 'owner';
  END IF;

  -- Check shared permission
  RETURN (
    SELECT permission_level
    FROM project_shares
    WHERE project_id = check_project_id AND user_id = check_user_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. UPDATE RLS POLICIES FOR PROJECTS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- SELECT: View own projects OR projects shared with you
CREATE POLICY "Users can view own or shared projects"
  ON projects FOR SELECT
  USING (
    user_id = auth.uid()
    OR has_project_access(id, auth.uid())
  );

-- INSERT: Only create your own projects
CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Only owner OR users with edit/admin permission
CREATE POLICY "Users can update own or shared projects with edit permission"
  ON projects FOR UPDATE
  USING (
    user_id = auth.uid()
    OR get_project_permission(id, auth.uid()) IN ('edit', 'admin')
  );

-- DELETE: Only owner can delete
CREATE POLICY "Only owners can delete projects"
  ON projects FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 7. UPDATE RLS POLICIES FOR PINS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own pins" ON pins;
DROP POLICY IF EXISTS "Users can insert own pins" ON pins;
DROP POLICY IF EXISTS "Users can update own pins" ON pins;
DROP POLICY IF EXISTS "Users can delete own pins" ON pins;

-- Enable RLS
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- SELECT: View pins in projects you have access to
CREATE POLICY "Users can view pins in accessible projects"
  ON pins FOR SELECT
  USING (
    user_id = auth.uid()
    OR (project_id IS NOT NULL AND has_project_access(project_id, auth.uid()))
  );

-- INSERT: Create pins in your projects OR shared projects with edit/admin
CREATE POLICY "Users can create pins in accessible projects"
  ON pins FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

-- UPDATE: Update pins in your projects OR shared projects with edit/admin
CREATE POLICY "Users can update pins in editable projects"
  ON pins FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

-- DELETE: Delete pins in your projects OR shared projects with edit/admin
CREATE POLICY "Users can delete pins in editable projects"
  ON pins FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

-- ============================================================================
-- 8. UPDATE RLS POLICIES FOR LINES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own lines" ON lines;
DROP POLICY IF EXISTS "Users can insert own lines" ON lines;
DROP POLICY IF EXISTS "Users can update own lines" ON lines;
DROP POLICY IF EXISTS "Users can delete own lines" ON lines;

ALTER TABLE lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lines in accessible projects"
  ON lines FOR SELECT
  USING (
    user_id = auth.uid()
    OR (project_id IS NOT NULL AND has_project_access(project_id, auth.uid()))
  );

CREATE POLICY "Users can create lines in accessible projects"
  ON lines FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can update lines in editable projects"
  ON lines FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can delete lines in editable projects"
  ON lines FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

-- ============================================================================
-- 9. UPDATE RLS POLICIES FOR AREAS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own areas" ON areas;
DROP POLICY IF EXISTS "Users can insert own areas" ON areas;
DROP POLICY IF EXISTS "Users can update own areas" ON areas;
DROP POLICY IF EXISTS "Users can delete own areas" ON areas;

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view areas in accessible projects"
  ON areas FOR SELECT
  USING (
    user_id = auth.uid()
    OR (project_id IS NOT NULL AND has_project_access(project_id, auth.uid()))
  );

CREATE POLICY "Users can create areas in accessible projects"
  ON areas FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can update areas in editable projects"
  ON areas FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can delete areas in editable projects"
  ON areas FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

-- ============================================================================
-- 10. UPDATE RLS POLICIES FOR TAGS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tags" ON tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
DROP POLICY IF EXISTS "Users can update own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tags in accessible projects"
  ON tags FOR SELECT
  USING (
    user_id = auth.uid()
    OR (project_id IS NOT NULL AND has_project_access(project_id, auth.uid()))
  );

CREATE POLICY "Users can create tags in accessible projects"
  ON tags FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can update tags in editable projects"
  ON tags FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can delete tags in editable projects"
  ON tags FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND get_project_permission(project_id, auth.uid()) IN ('edit', 'admin')
    )
  );

-- ============================================================================
-- 11. UPDATE RLS POLICIES FOR pin_files
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can insert own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can delete own pin files" ON pin_files;

ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files in accessible projects"
  ON pin_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pins
      WHERE pins.id = pin_files.pin_id
      AND (
        pins.user_id = auth.uid()
        OR (pins.project_id IS NOT NULL AND has_project_access(pins.project_id, auth.uid()))
      )
    )
  );

CREATE POLICY "Users can upload files to editable projects"
  ON pin_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pins
      WHERE pins.id = pin_files.pin_id
      AND (
        pins.user_id = auth.uid()
        OR (
          pins.project_id IS NOT NULL
          AND get_project_permission(pins.project_id, auth.uid()) IN ('edit', 'admin')
        )
      )
    )
  );

CREATE POLICY "Users can delete files from editable projects"
  ON pin_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pins
      WHERE pins.id = pin_files.pin_id
      AND (
        pins.user_id = auth.uid()
        OR (
          pins.project_id IS NOT NULL
          AND get_project_permission(pins.project_id, auth.uid()) IN ('edit', 'admin')
        )
      )
    )
  );

-- ============================================================================
-- 12. ENABLE RLS ON project_shares AND project_invitations
-- ============================================================================

ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- project_shares policies
CREATE POLICY "Users can view shares for their projects or shared projects"
  ON project_shares FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_shares.project_id
      AND user_id = auth.uid()
    )
    OR get_project_permission(project_id, auth.uid()) = 'admin'
  );

CREATE POLICY "Only project owners and admins can create shares"
  ON project_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_shares.project_id
      AND user_id = auth.uid()
    )
    OR get_project_permission(project_id, auth.uid()) = 'admin'
  );

CREATE POLICY "Only project owners and admins can delete shares"
  ON project_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_shares.project_id
      AND user_id = auth.uid()
    )
    OR get_project_permission(project_id, auth.uid()) = 'admin'
  );

-- project_invitations policies
CREATE POLICY "Users can view invitations for their projects"
  ON project_invitations FOR SELECT
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_invitations.project_id
      AND user_id = auth.uid()
    )
    OR get_project_permission(project_id, auth.uid()) = 'admin'
  );

CREATE POLICY "Only project owners and admins can create invitations"
  ON project_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_invitations.project_id
      AND user_id = auth.uid()
    )
    OR get_project_permission(project_id, auth.uid()) = 'admin'
  );

CREATE POLICY "Invitees and project owners can update invitations"
  ON project_invitations FOR UPDATE
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_invitations.project_id
      AND user_id = auth.uid()
    )
    OR get_project_permission(project_id, auth.uid()) = 'admin'
  );
