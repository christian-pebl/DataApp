# Manual File Persistence Test Instructions

## Test Steps:

### 1. Initial Setup
- Open browser to http://localhost:9002/auth
- Login with: christiannberger@gmail.com / Mewslade123@

### 2. Create Pin and Upload File
- Click on the map to create a new pin
- Give it a label like "Test Pin Jan 9"
- Save the pin
- Click on the pin again to select it
- Click "Data" button
- Click "Upload data"
- Upload any CSV file
- **VERIFY**: File count shows "Explore data (1 file)"

### 3. Test Persistence
- Click Menu → Logout
- Login again with same credentials
- Click on the same pin
- Click "Data" button
- **VERIFY**: File count should still show "Explore data (1 file)"
- Click on "Explore data" dropdown
- **VERIFY**: Your uploaded file should be listed

## Expected Result:
✅ Files should persist after logout/login

## What Was Fixed:
The UI was only showing local files (pinFiles) instead of database files (pinFileMetadata). 
Now it shows both combined:
- Local files (newly uploaded, not yet saved)
- Database files (persisted from previous sessions)

## Code Changes Made:
1. Updated file count display to use: `(pinFileMetadata[id]?.length || 0) + (pinFiles[id]?.length || 0)`
2. Updated file selection dropdown to include files from both sources
3. Ensured dropdown stays open after file upload for visual feedback