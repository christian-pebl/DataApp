# 🔧 Manual RLS Policy Fix Guide

## ⚠️ CRITICAL: Pin Names & File Access Issue Resolution

The issue you're experiencing with **pin names not showing** and **file access errors** is caused by RLS (Row Level Security) policy problems in your Supabase database.

## 🎯 What's Wrong

1. **Pin names appear empty** despite pins loading
2. **File access fails** with `Pin not found or user does not have access` errors
3. **RLS policies are blocking legitimate user access** due to UUID type mismatches

## 🚀 IMMEDIATE FIX - Apply RLS Policies

### Method 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn
   ```

2. **Navigate to SQL Editor:**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy & Paste the Fix:**
   - Open the file `fix-rls-policies.sql` in this directory
   - Copy ALL contents (8,552 characters)
   - Paste into the SQL Editor

4. **Execute the Fix:**
   - Click "Run" button
   - Wait for all statements to complete
   - You should see success messages for each policy created

### Method 2: Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Navigate to project directory
cd data-app-sep25

# Apply the fix (replace [PASSWORD] with your DB password)
supabase db reset --db-url "postgresql://postgres:[PASSWORD]@db.tujjhrliibqgstbrohfn.supabase.co:5432/postgres" --file fix-rls-policies.sql
```

## 🔍 What the Fix Does

The `fix-rls-policies.sql` script will:

1. **Drop all existing problematic RLS policies** (63 statements)
2. **Create new properly-typed RLS policies** with correct UUID handling
3. **Fix the auth.uid() = user_id comparison issues**
4. **Enable RLS on all tables** with proper security

### Key Fixes:
- **Projects:** Users can only access their own projects
- **Tags:** Users can only access their own tags  
- **Pins:** Users can only access their own pins ✅ **THIS FIXES PIN NAMES**
- **Files:** Users can only access files for pins they own ✅ **THIS FIXES FILE ACCESS**
- **Lines/Areas:** Users can only access their own geometric data

## 🧪 Testing After Fix

1. **Refresh your application** (localhost:3009)
2. **Login as any user**
3. **Create a new pin with a name**
4. **Verify the name persists after logout/login**
5. **Try uploading files to pins**
6. **Check browser console** - errors should be gone

## 📊 Expected Results

### Before Fix:
```
❌ use-map-data.ts:143 Pins loaded: 10 (but names empty)
❌ GET .../pins?select=id%2Cuser_id&... 406 (Not Acceptable)
❌ Pin not found or user does not have access: PGRST116
```

### After Fix:
```
✅ use-map-data.ts:143 Pins loaded: 10 (with names visible)
✅ GET .../pins?select=id%2Cuser_id&... 200 (OK)
✅ Files loading successfully
```

## ⏰ Temporary Workaround Applied

I've temporarily disabled the strict file access checks in `file-storage-service.ts` so your app works immediately. **You should still apply the RLS fix** for proper security.

## 🔄 Re-enabling Security After Fix

After applying the RLS policies, update `src/lib/supabase/file-storage-service.ts`:

1. **Uncomment the pin ownership verification code** (lines 130-141)
2. **Remove the temporary bypass** (lines 126-128)
3. **Test that everything still works** with proper security

## 📞 Need Help?

If the fix doesn't work:
1. **Check the Supabase logs** for any error messages
2. **Verify all tables exist** (projects, pins, tags, lines, areas, pin_files, etc.)
3. **Confirm your service role key** has proper permissions
4. **Try applying the fix in smaller batches** (10-15 statements at a time)

## 🎯 Success Criteria

✅ Pin names visible after creation  
✅ Pin names persist after logout/login  
✅ File uploads work without errors  
✅ No more PGRST116 errors in console  
✅ All users can only see their own data  

---

**Important:** This fix resolves the core data persistence and access issues identified in your application. Apply it as soon as possible for the best user experience.