DROP POLICY IF EXISTS "Users can insert their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can view their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can update their own pin files" ON pin_files;
DROP POLICY IF EXISTS "Users can delete their own pin files" ON pin_files;

ALTER TABLE pin_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own pin files"
ON pin_files FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id::text = pin_files.pin_id::text
    AND pins.user_id::text = auth.uid()::text
  )
);

CREATE POLICY "Users can view their own pin files"
ON pin_files FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id::text = pin_files.pin_id::text
    AND pins.user_id::text = auth.uid()::text
  )
);

CREATE POLICY "Users can update their own pin files"
ON pin_files FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id::text = pin_files.pin_id::text
    AND pins.user_id::text = auth.uid()::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id::text = pin_files.pin_id::text
    AND pins.user_id::text = auth.uid()::text
  )
);

CREATE POLICY "Users can delete their own pin files"
ON pin_files FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pins
    WHERE pins.id::text = pin_files.pin_id::text
    AND pins.user_id::text = auth.uid()::text
  )
);

GRANT ALL ON pin_files TO authenticated;
