DROP POLICY IF EXISTS "Users can insert their own areas" ON areas;
DROP POLICY IF EXISTS "Users can view their own areas" ON areas;
DROP POLICY IF EXISTS "Users can update their own areas" ON areas;
DROP POLICY IF EXISTS "Users can delete their own areas" ON areas;

CREATE POLICY "Users can insert their own areas"
ON areas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own areas"
ON areas
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own areas"
ON areas
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own areas"
ON areas
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
