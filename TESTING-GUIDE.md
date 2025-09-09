# 📋 Pin Data Upload & Sharing Test Guide

## 🎯 Test Objectives
Test that pin data files are:
1. Successfully uploaded and stored
2. Persisted across login sessions
3. Visible when pins are shared
4. Properly secured with user permissions

## 📝 Step-by-Step Testing Process

### Step 1: Initial Setup
1. **Open the app**: http://localhost:9002
2. **Sign in** with Google authentication
3. **Verify** you're logged in (user icon/email visible)

### Step 2: Create Test Pin with Data
1. **Click on the map** to create a new pin
2. **Add details**:
   - Label: "Test Pin with Data"
   - Notes: "Testing file upload persistence"
3. **Save the pin**
4. **Click on the pin** to open properties panel
5. **Upload test file**:
   - Click the upload button (📎 or Upload icon)
   - Select `test-data.csv` file
   - Wait for upload confirmation
6. **Verify** file appears in the pin's file list

### Step 3: Test Persistence (Logout/Login)
1. **Note the pin location** on the map
2. **Sign out** (click user menu → Sign Out)
3. **Verify** you're redirected to login page
4. **Sign in again** with the same account
5. **Check**:
   - ✅ Pin still exists at same location
   - ✅ Pin label and notes are preserved
   - ✅ Uploaded file is still attached
   - ✅ File can be downloaded

### Step 4: Test Sharing Functionality
1. **Click on your test pin**
2. **Click the Share button** (Share2 icon)
3. **Test User Sharing**:
   - Enter another email address
   - Select permission level (View/Edit/Admin)
   - Click "Share with User"
   - Verify share appears in list
4. **Test Public Link**:
   - Switch to "Public Link" tab
   - Select permission level
   - Optional: Set password
   - Click "Generate Public Link"
   - Copy the generated link

### Step 5: Test Shared Access
1. **Open an incognito/private browser window**
2. **Paste the public share link**
3. **Verify**:
   - ✅ Pin details are visible
   - ✅ Location is shown on map
   - ✅ Files are listed
   - ✅ Files can be downloaded (if permission allows)
   - ❌ Edit/Delete buttons hidden (for view-only)

### Step 6: Verify Data Security
1. **In incognito window** (not logged in):
   - Try accessing: http://localhost:9002/map-drawing
   - ❌ Should NOT see any pins without authentication
2. **Create a second test account**:
   - Sign in with different Google account
   - ❌ Should NOT see first user's pins
   - ✅ Should only see pins shared with them

## 🔍 Console Checks
Open browser DevTools (F12) and check:
- **Console tab**: No red errors
- **Network tab**: All API calls successful (200/201 status)
- **Application tab** → Storage: Check for auth tokens

## ✅ Success Criteria
- [ ] Pin creation works
- [ ] File upload completes successfully
- [ ] Data persists after logout/login
- [ ] Files remain attached to pins
- [ ] Sharing creates working links
- [ ] Shared users can view pins
- [ ] Permissions are enforced
- [ ] No console errors
- [ ] Network requests succeed

## 🐛 Common Issues & Solutions

### Issue: Files not uploading
- **Check**: Supabase storage bucket exists
- **Solution**: Create `pin-files` bucket in Supabase dashboard

### Issue: Pins not persisting
- **Check**: Database tables exist
- **Solution**: Run migration script

### Issue: Sharing not working
- **Check**: Sharing tables exist
- **Solution**: Apply sharing migration in Supabase

### Issue: Authentication errors
- **Check**: Google OAuth configured
- **Solution**: Set up OAuth in Supabase dashboard

## 📊 Expected Results
After completing all steps:
1. ✅ Pin with uploaded CSV file persists
2. ✅ Data survives logout/login cycles
3. ✅ Shared pins accessible via link
4. ✅ Permissions properly enforced
5. ✅ No data leakage between users

## 🎉 Test Complete!
If all checks pass, the pin data upload and sharing system is working correctly!