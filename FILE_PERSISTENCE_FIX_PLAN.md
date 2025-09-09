# File Persistence Fix - Implementation & Test Plan

## Problem Statement
Uploaded CSV files to pins are not persisting across user logout/login sessions. Files appear to upload successfully but disappear after re-authentication.

## Root Cause Analysis Checklist
- [ ] Files actually uploading to Supabase storage?
- [ ] File metadata saved to pin_files table?
- [ ] Correct user_id associations?
- [ ] RLS policies blocking access?
- [ ] Files loaded on app initialization?
- [ ] State management preserving data?

---

## PHASE 1: DIAGNOSTIC AGENT
**Objective**: Identify exact point of failure in file persistence

### Tasks:
1. **Supabase Storage Audit**
   ```sql
   -- Check storage bucket for files
   SELECT * FROM storage.objects 
   WHERE bucket_id = 'pins' 
   ORDER BY created_at DESC;
   ```

2. **Database Records Audit**
   ```sql
   -- Check pin_files table
   SELECT pf.*, p.user_id as pin_owner 
   FROM pin_files pf
   JOIN pins p ON pf.pin_id = p.id
   WHERE p.user_id = '[USER_ID]'
   ORDER BY pf.created_at DESC;
   ```

3. **RLS Policy Verification**
   ```sql
   -- Check RLS policies
   SELECT * FROM pg_policies 
   WHERE tablename IN ('pins', 'pin_files');
   ```

4. **Code Flow Analysis**
   - Trace: `handleFileUpload()` → `uploadPinFile()` → Supabase
   - Trace: `loadDatabaseData()` → `getPinFiles()` → State
   - Check: localStorage vs Supabase sync

### Expected Outputs:
- Diagnostic report identifying failure point
- SQL query results showing data state
- Console log analysis
- Recommended fix approach

---

## PHASE 2: IMPLEMENTATION AGENT
**Objective**: Fix file persistence with proper Supabase integration

### Implementation Tasks:

#### Task 1: Fix File Upload Flow
```javascript
// Ensure proper file upload with user association
const uploadPinFile = async (pinId, file, userId) => {
  // 1. Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('pins')
    .upload(filePath, file);
    
  // 2. Save metadata to database
  const { data: dbData, error: dbError } = await supabase
    .from('pin_files')
    .insert({
      pin_id: pinId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      user_id: userId // Critical!
    });
    
  // 3. Return complete metadata
  return dbData;
};
```

#### Task 2: Fix File Loading on Init
```javascript
// Load all user files on app initialization
const loadUserPinFiles = async () => {
  // Get all pins for user
  const { data: pins } = await supabase
    .from('pins')
    .select('id')
    .eq('user_id', user.id);
    
  // Get all files for those pins
  const { data: files } = await supabase
    .from('pin_files')
    .select('*')
    .in('pin_id', pins.map(p => p.id));
    
  // Update state
  setPinFileMetadata(files);
};
```

#### Task 3: State Management Fix
- Clear localStorage only on logout, not on load
- Sync Supabase → State on every app load
- Maintain pinFiles and pinFileMetadata consistency

### Deliverables:
- Updated file-storage-service.ts
- Fixed loadDatabaseData function
- Proper state initialization

---

## PHASE 3: TESTING AGENT
**Objective**: Comprehensive automated testing with Playwright

### Test Suite Structure:

#### Test 1: Basic File Persistence
```javascript
test('File persists after logout/login', async ({ page }) => {
  // 1. Login as test user
  await loginWithUser(page, testUser1);
  
  // 2. Create pin and upload file
  const pinId = await createTestPin(page);
  await uploadTestFile(page, pinId, 'test-data.csv');
  
  // 3. Verify file appears
  await expect(page.locator('.file-list')).toContainText('test-data.csv');
  
  // 4. Logout
  await logout(page);
  
  // 5. Login again
  await loginWithUser(page, testUser1);
  
  // 6. Navigate to pin
  await navigateToPin(page, pinId);
  
  // 7. Verify file still exists
  await expect(page.locator('.file-list')).toContainText('test-data.csv');
});
```

#### Test 2: Multi-User Isolation
```javascript
test('Users only see their own files', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  // User 1 uploads file
  await loginWithUser(page1, testUser1);
  await uploadTestFile(page1, pinId, 'user1-private.csv');
  
  // User 2 checks same pin
  await loginWithUser(page2, testUser2);
  await navigateToPin(page2, pinId);
  
  // User 2 should NOT see User 1's file
  await expect(page2.locator('.file-list')).not.toContainText('user1-private.csv');
});
```

#### Test 3: Multiple Files & Pins
```javascript
test('Multiple files across multiple pins persist', async ({ page }) => {
  await loginWithUser(page, testUser1);
  
  // Create 3 pins with files
  const pins = [];
  for (let i = 1; i <= 3; i++) {
    const pin = await createTestPin(page, `Pin ${i}`);
    await uploadTestFile(page, pin.id, `file${i}.csv`);
    pins.push(pin);
  }
  
  // Logout and login
  await logout(page);
  await loginWithUser(page, testUser1);
  
  // Verify all files persist
  for (const pin of pins) {
    await navigateToPin(page, pin.id);
    await expect(page.locator('.file-list')).toBeVisible();
  }
});
```

### Test Execution Plan:
1. Run diagnostic queries first
2. Apply fixes
3. Run test suite
4. Verify in Supabase dashboard
5. Test with both test users

---

## PHASE 4: VERIFICATION AGENT
**Objective**: Ensure fix works in all scenarios

### Verification Checklist:

#### Database Verification
- [ ] Files exist in storage.objects table
- [ ] pin_files records have correct user_id
- [ ] No orphaned records
- [ ] Proper foreign key relationships

#### UI Verification
- [ ] File count updates correctly
- [ ] Dropdown shows files after upload
- [ ] Files accessible after page refresh
- [ ] Files accessible after logout/login

#### Performance Verification
- [ ] File upload < 3 seconds
- [ ] File list load < 1 second
- [ ] No memory leaks
- [ ] Reasonable network requests

#### Security Verification
- [ ] Users can't access other users' files
- [ ] RLS policies enforced
- [ ] No exposed file URLs
- [ ] Proper error handling

### Manual Test Script:
1. **Setup**
   - Clear all test data
   - Open Supabase dashboard
   - Open browser DevTools

2. **Test Execution**
   - Login as christiannberger@gmail.com
   - Create pin "Test Location 1"
   - Upload sample.csv (monitor network)
   - Check Supabase dashboard for file
   - Open data explorer - verify loads
   - Logout (check localStorage cleared)
   - Login again
   - Navigate to "Test Location 1"
   - ✓ File should be visible
   - ✓ Data should load

3. **Cross-User Test**
   - Stay logged in as User 1
   - Open incognito window
   - Login as christian@pebl-cic.co.uk
   - Check same location
   - ✓ Should NOT see User 1's files

---

## Success Metrics
- **Functional**: 100% file persistence across sessions
- **Performance**: <2s total load time
- **Security**: Complete user isolation
- **Reliability**: 0% data loss rate
- **UX**: Clear visual feedback

## Rollback Plan
If issues arise:
1. Git stash changes
2. Restore previous version
3. Document failure points
4. Retry with modified approach

## Timeline
- **Phase 1**: 30 minutes (Diagnosis)
- **Phase 2**: 45 minutes (Implementation)
- **Phase 3**: 30 minutes (Testing)
- **Phase 4**: 15 minutes (Verification)
- **Total**: ~2 hours

## Tools Required
- Supabase MCP for database queries
- Playwright MCP for automated testing
- Browser DevTools for network monitoring
- Supabase Dashboard for visual verification

---

## Next Steps
1. Start with Diagnostic Agent to identify root cause
2. Implement fixes based on findings
3. Run comprehensive test suite
4. Verify with manual testing
5. Document solution for future reference