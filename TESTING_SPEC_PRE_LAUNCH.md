# Pre-Launch Testing Specification
## PEBL Data Application - Vercel Deployment Readiness

**Version:** 1.0
**Date:** January 24, 2025
**Target Environment:** Vercel Production

---

## 1. Authentication & User Management

### 1.1 Sign Up Flow
- [ ] Navigate to sign-up page
- [ ] Create new account with valid email
- [ ] Verify email confirmation is sent
- [ ] Confirm account via email link
- [ ] Log in with new credentials
- [ ] **Expected:** User successfully authenticated and redirected to map view

### 1.2 Login Flow
- [ ] Log in with existing credentials
- [ ] Test "Remember Me" functionality
- [ ] Test logout functionality
- [ ] **Expected:** Smooth login/logout cycle

### 1.3 Password Reset
- [ ] Click "Forgot Password"
- [ ] Enter email and request reset
- [ ] Verify reset email received
- [ ] Complete password reset flow
- [ ] Log in with new password
- [ ] **Expected:** Password successfully changed

### 1.4 Data Restoration
- [ ] Log in as existing user with saved data
- [ ] Verify "Restore Previous Session" dialog appears
- [ ] Click "Restore" and verify all data loads correctly:
  - [ ] Projects restored
  - [ ] Pins restored with correct positions
  - [ ] Lines restored with correct paths
  - [ ] Areas restored with correct polygons
  - [ ] Pin files attached correctly
  - [ ] Plot configurations preserved
- [ ] **Expected:** Complete state restoration without errors

---

## 2. Map Functionality

### 2.1 Basic Map Interaction
- [ ] Pan the map in all directions
- [ ] Zoom in/out using mouse wheel
- [ ] Zoom in/out using +/- buttons
- [ ] Test on different zoom levels (1-18)
- [ ] Verify smooth 60fps dragging (no jagged movement)
- [ ] **Expected:** Smooth map interaction without lag

### 2.2 Drawing Tools
#### Pins
- [ ] Enable pin drawing mode
- [ ] Click to place pin on map
- [ ] Verify pin appears at correct location
- [ ] Verify pin has default name (Pin 1, Pin 2, etc.)
- [ ] Place multiple pins
- [ ] **Expected:** Pins placed accurately with crosshair precision

#### Lines
- [ ] Enable line drawing mode
- [ ] Click multiple points to create polyline
- [ ] Double-click to finish line
- [ ] Verify line follows drawn path
- [ ] Verify line has default name (Line 1, Line 2, etc.)
- [ ] Draw multiple lines
- [ ] **Expected:** Lines drawn smoothly with visible crosshair

#### Areas
- [ ] Enable area drawing mode
- [ ] Click multiple points to create polygon
- [ ] Click first point again to close area
- [ ] Verify area fills correctly
- [ ] Verify area has default name (Area 1, Area 2, etc.)
- [ ] Draw multiple areas
- [ ] **Expected:** Areas created with correct boundaries

### 2.3 Editing Map Features
- [ ] Select existing pin and drag to new location
- [ ] Select existing line and edit vertices
- [ ] Select existing area and edit vertices
- [ ] Delete pin (click delete button)
- [ ] Delete line (click delete button)
- [ ] Delete area (click delete button)
- [ ] **Expected:** All edit operations work smoothly

### 2.4 Styling Map Features
#### Pin Styling
- [ ] Click color picker for pin
- [ ] Change pin color
- [ ] Verify color updates immediately on map
- [ ] Test with multiple pins

#### Line Styling
- [ ] Open line styling dialog
- [ ] Change line color
- [ ] Change line width (1-10)
- [ ] Change line style (solid, dashed, dotted)
- [ ] Verify changes apply to map
- [ ] **Expected:** All styling options work correctly

#### Area Styling
- [ ] Open area styling dialog
- [ ] Change fill color
- [ ] Change fill opacity (0-100%)
- [ ] Change border color
- [ ] Change border width
- [ ] Verify changes apply to map
- [ ] **Expected:** All styling options work correctly

---

## 3. Data Upload & File Management

### 3.1 Pin File Upload
- [ ] Click pin on map to open details panel
- [ ] Click "Upload File" or drag-drop CSV file
- [ ] Test with various file types:
  - [ ] Continuous timeseries (FPOD, Marine Meteo)
  - [ ] Discrete sampling (CROP, CHEM, WQ, EDNA)
  - [ ] Custom CSV with date columns
- [ ] Verify file uploads successfully
- [ ] Verify file appears in pin's file list
- [ ] **Expected:** Files upload without errors

### 3.2 File Metadata Detection
- [ ] Upload file with clear filename date pattern (e.g., `CROP_2023_2024.csv`)
- [ ] Verify system detects date range from filename
- [ ] Upload file with date column (Date, DateTime, Timestamp, etc.)
- [ ] Verify system detects date column automatically
- [ ] **Expected:** Dates parsed correctly with proper DD/MM/YYYY vs MM/DD/YYYY handling

### 3.3 Multi-File Operations
- [ ] Upload multiple files to same pin
- [ ] Verify all files appear in list
- [ ] Select multiple files for plotting
- [ ] Verify merged plot functionality works
- [ ] **Expected:** Multiple files handled correctly

### 3.4 File Download
- [ ] Click "Download" button on uploaded file
- [ ] Verify file downloads correctly
- [ ] Open downloaded file and verify content matches original
- [ ] **Expected:** File download works correctly

### 3.5 File Deletion
- [ ] Click delete button on file
- [ ] Confirm deletion in dialog
- [ ] Verify file removed from list
- [ ] Verify file removed from database
- [ ] **Expected:** File deleted completely

---

## 4. Data Visualization & Plotting

### 4.1 Timeseries Plotting (Continuous Data)
- [ ] Upload Marine Meteo file to pin
- [ ] Select parameter (Wind Speed, Air Temp, etc.)
- [ ] Click "Plot" button
- [ ] Verify plot appears with correct data
- [ ] Verify X-axis shows dates correctly
- [ ] Verify Y-axis shows values correctly
- [ ] Verify plot title shows parameter name
- [ ] Test with multiple parameters plotted together
- [ ] **Expected:** Plots render correctly with accurate data

### 4.2 Discrete Sampling Plots
- [ ] Upload CROP file to pin
- [ ] Select parameters (Length, Width, etc.)
- [ ] Choose plot type: Column Chart or Whisker Plot
- [ ] Click "Plot" button
- [ ] Verify plot appears with correct data
- [ ] **Column Chart:**
  - [ ] Verify bars show correct heights
  - [ ] Verify error bars display (if applicable)
  - [ ] Verify colors match styling rules
- [ ] **Whisker Plot:**
  - [ ] Verify median line visible
  - [ ] Verify quartile boxes correct
  - [ ] Verify whiskers extend properly
  - [ ] Verify outliers displayed as points
- [ ] **Expected:** Discrete plots render correctly

### 4.3 eDNA Plots
- [ ] Upload EDNA file to pin
- [ ] Select "Credibility Stacked Chart"
- [ ] Verify chart shows credibility levels (Certain, Probable, Unlikely)
- [ ] Select "Taxonomy Stacked Chart"
- [ ] Verify chart shows taxonomy groups (Fish, Mammals, Invertebrates, etc.)
- [ ] **Expected:** eDNA visualizations display correctly

### 4.4 Merged Plots (Dual Axis)
- [ ] Upload two files to same pin
- [ ] Select different parameters from each file
- [ ] Enable "Merged Plot" mode
- [ ] Verify dual Y-axis appears
- [ ] Verify both parameters plot correctly
- [ ] Verify axis labels correct
- [ ] Test same parameter from two different sources
- [ ] **Expected:** Merged plots work correctly

### 4.5 Plot Interactions
- [ ] Hover over plot line to see tooltip with value
- [ ] Click legend to toggle line visibility
- [ ] Click line directly to toggle visibility
- [ ] Zoom in on plot using mouse wheel
- [ ] Pan plot by dragging
- [ ] Reset plot zoom
- [ ] **Expected:** All interactions work smoothly

### 4.6 Plot Customization
- [ ] Change Y-axis label (custom text)
- [ ] Toggle compact view mode
- [ ] Apply moving average (7-day, 30-day, etc.)
- [ ] Change line colors
- [ ] Change line styles
- [ ] Export plot as image (if available)
- [ ] **Expected:** Customizations apply correctly

### 4.7 Saved Plot Views
- [ ] Configure plot with custom settings
- [ ] Save plot view with name
- [ ] Navigate away from pin
- [ ] Return to pin
- [ ] Restore saved plot view
- [ ] Verify all settings restored correctly:
  - [ ] Selected parameters
  - [ ] Y-axis labels
  - [ ] Line colors/styles
  - [ ] Compact view setting
  - [ ] Moving average settings
- [ ] Delete saved plot view
- [ ] **Expected:** Plot views save and restore perfectly

---

## 5. Timeline Functionality

### 5.1 Timeline Display
- [ ] Click "Fetch Times" button in toolbar
- [ ] Verify timeline panel appears at bottom
- [ ] Verify timeline shows date range for all files
- [ ] Verify each file has colored segment on timeline
- [ ] **Expected:** Timeline displays all file date ranges

### 5.2 Timeline Interaction
- [ ] Hover over timeline segment to see file details
- [ ] Click timeline segment to highlight file
- [ ] Verify timeline updates when files added/removed
- [ ] **Expected:** Timeline interactive and responsive

### 5.3 Date Range Analysis
- [ ] Verify timeline correctly handles:
  - [ ] Continuous timeseries (daily data)
  - [ ] Discrete sampling (sparse dates)
  - [ ] Mixed file types on same pin
- [ ] **Expected:** All date types display correctly

---

## 6. Project Management

### 6.1 Create Project
- [ ] Click "New Project" button
- [ ] Enter project name
- [ ] Click "Create"
- [ ] Verify project appears in project list
- [ ] **Expected:** Project created successfully

### 6.2 Switch Projects
- [ ] Create multiple projects
- [ ] Add different map features to each
- [ ] Switch between projects
- [ ] Verify each project loads correct map features
- [ ] **Expected:** Projects isolated correctly

### 6.3 Delete Project
- [ ] Open project settings
- [ ] Click "Delete Project"
- [ ] Confirm deletion
- [ ] Verify project removed from list
- [ ] Verify all associated data deleted
- [ ] **Expected:** Project and data deleted completely

### 6.4 Project Settings
- [ ] Open project settings dialog
- [ ] Verify project name displayed
- [ ] Verify creation date displayed
- [ ] Test any other project settings
- [ ] **Expected:** Settings display and work correctly

---

## 7. Filter System

### 7.1 Credibility Filters (eDNA)
- [ ] Upload EDNA file
- [ ] Open filter dialog
- [ ] Apply credibility filter (e.g., only "Certain")
- [ ] Verify plot updates to show only filtered data
- [ ] Change filter to multiple levels
- [ ] Clear filter
- [ ] **Expected:** Filters apply correctly to plots

### 7.2 Species/Taxonomy Filters
- [ ] Apply taxonomy filter (e.g., only "Fish")
- [ ] Verify filtered data displays
- [ ] Apply multiple taxonomy filters
- [ ] Clear filters
- [ ] **Expected:** Taxonomy filtering works

### 7.3 Date Range Filters
- [ ] Set start date filter
- [ ] Set end date filter
- [ ] Verify plot shows only data within range
- [ ] Clear date filters
- [ ] **Expected:** Date filtering works correctly

### 7.4 Parameter-Specific Filters
- [ ] Test filters on different parameter types
- [ ] Verify filter persistence when switching parameters
- [ ] Verify filters save with plot views
- [ ] **Expected:** Filters work across all scenarios

---

## 8. Data Explorer

### 8.1 Navigate to Data Explorer
- [ ] Click "Data Explorer" link in navigation
- [ ] Verify page loads
- [ ] Verify user's files listed
- [ ] **Expected:** Data explorer accessible

### 8.2 File List Display
- [ ] Verify all uploaded files appear
- [ ] Verify file metadata shown (name, size, upload date)
- [ ] Verify files grouped by pin (if applicable)
- [ ] **Expected:** File list complete and accurate

### 8.3 File Actions
- [ ] Click "Open" on file (if implemented)
- [ ] Click "Rename" on file
- [ ] Enter new name and save
- [ ] Verify name updates in list
- [ ] Click "Delete" on file
- [ ] Confirm deletion
- [ ] Verify file removed
- [ ] **Expected:** All file actions work

---

## 9. Performance Testing

### 9.1 Map Performance
- [ ] Load map with 50+ pins
- [ ] Verify map loads in < 3 seconds
- [ ] Drag map continuously for 30 seconds
- [ ] Verify smooth 60fps dragging throughout
- [ ] Zoom rapidly in and out
- [ ] Verify no lag or freezing
- [ ] **Expected:** Excellent performance under load

### 9.2 Plot Performance
- [ ] Upload file with 10,000+ data points
- [ ] Plot all data
- [ ] Verify plot renders in < 5 seconds
- [ ] Interact with plot (zoom, pan)
- [ ] Verify interactions remain smooth
- [ ] **Expected:** Large datasets handled efficiently

### 9.3 Page Load Performance
- [ ] Refresh page with logged-in user
- [ ] Measure time until map fully interactive
- [ ] Verify no visible flashing or re-renders
- [ ] **Expected:** Page loads smoothly in < 2 seconds

---

## 10. Database & Data Persistence

### 10.1 Data Saving
- [ ] Create map features (pins, lines, areas)
- [ ] Upload files to pins
- [ ] Create plots
- [ ] Refresh browser (F5)
- [ ] Verify all data persists after refresh
- [ ] **Expected:** No data loss on refresh

### 10.2 Cross-Device Sync
- [ ] Log in on Device A
- [ ] Create map features
- [ ] Log in on Device B with same account
- [ ] Verify all features appear on Device B
- [ ] Make changes on Device B
- [ ] Refresh Device A
- [ ] Verify changes synced
- [ ] **Expected:** Data syncs across devices

### 10.3 Concurrent Editing
- [ ] Open app in two browser tabs with same account
- [ ] Make changes in Tab 1
- [ ] Refresh Tab 2
- [ ] Verify changes appear in Tab 2
- [ ] **Expected:** No data conflicts or corruption

---

## 11. Error Handling & Edge Cases

### 11.1 Network Errors
- [ ] Disconnect internet
- [ ] Try to upload file
- [ ] Verify error message displays
- [ ] Reconnect internet
- [ ] Retry upload
- [ ] Verify operation completes
- [ ] **Expected:** Graceful error handling

### 11.2 Invalid File Uploads
- [ ] Try uploading non-CSV file
- [ ] Verify rejection with clear error message
- [ ] Upload CSV with invalid format
- [ ] Verify error handling
- [ ] Upload CSV with missing date column
- [ ] Verify appropriate warning/error
- [ ] **Expected:** Invalid files rejected gracefully

### 11.3 Database Limits
- [ ] Test with maximum reasonable data:
  - [ ] 100+ pins on map
  - [ ] 50+ files on single pin
  - [ ] Files with 50,000+ rows
- [ ] Verify system handles large data gracefully
- [ ] **Expected:** System scales appropriately

### 11.4 Empty States
- [ ] Test empty states:
  - [ ] New user with no data
  - [ ] Project with no map features
  - [ ] Pin with no files
  - [ ] File with no plottable parameters
- [ ] Verify helpful empty state messages display
- [ ] **Expected:** Clear guidance for empty states

---

## 12. Security Testing

### 12.1 Authentication Security
- [ ] Try accessing protected routes without login
- [ ] Verify redirect to login page
- [ ] Try accessing another user's data via URL manipulation
- [ ] Verify access denied
- [ ] **Expected:** Proper authentication enforcement

### 12.2 Row-Level Security (RLS)
- [ ] Create data with User A
- [ ] Log in as User B
- [ ] Verify User B cannot see User A's data
- [ ] Verify User B cannot modify User A's data
- [ ] **Expected:** RLS policies working correctly

### 12.3 File Upload Security
- [ ] Try uploading extremely large file (>100MB)
- [ ] Verify size limit enforcement
- [ ] Try uploading file with malicious filename
- [ ] Verify sanitization
- [ ] **Expected:** Upload security measures work

### 12.4 SQL Injection Prevention
- [ ] Try entering SQL code in text inputs:
  - [ ] Pin names
  - [ ] Project names
  - [ ] Custom Y-axis labels
- [ ] Verify no SQL execution
- [ ] **Expected:** All inputs sanitized

---

## 13. Cross-Browser Testing

Test ALL functionality above in:
- [ ] **Chrome** (latest version)
- [ ] **Firefox** (latest version)
- [ ] **Safari** (latest version)
- [ ] **Edge** (latest version)

**Expected:** Consistent behavior across all browsers

---

## 14. Mobile Responsiveness

### 14.1 Mobile Layout
- [ ] Open app on mobile device (or browser dev tools mobile view)
- [ ] Verify layout adapts to small screen
- [ ] Verify all buttons accessible
- [ ] Verify no horizontal scrolling
- [ ] **Expected:** Mobile-friendly layout

### 14.2 Touch Interactions
- [ ] Test map panning with touch
- [ ] Test pinch-to-zoom
- [ ] Test drawing pins/lines/areas with touch
- [ ] Test tapping UI elements
- [ ] **Expected:** Touch interactions work smoothly

### 14.3 Mobile Performance
- [ ] Verify app loads quickly on mobile network
- [ ] Verify map interaction smooth on mobile
- [ ] Verify plots render correctly on small screen
- [ ] **Expected:** Good mobile performance

---

## 15. Critical Pre-Launch Checklist

### 15.1 Environment Configuration
- [ ] Verify all environment variables set in Vercel:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (if used)
  - [ ] Any email service keys (if implemented)
- [ ] Verify production Supabase project configured
- [ ] Verify Supabase RLS policies enabled and tested

### 15.2 Database Migrations
- [ ] Verify all migrations run on production database
- [ ] Verify all tables have correct columns
- [ ] Verify all RLS policies applied
- [ ] Run SQL query to verify schema:
  ```sql
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position;
  ```

### 15.3 Storage Configuration
- [ ] Verify Supabase Storage bucket created
- [ ] Verify storage RLS policies configured
- [ ] Test file upload in production environment
- [ ] Test file download in production environment

### 15.4 Build & Deployment
- [ ] Run production build locally: `npm run build`
- [ ] Verify no TypeScript errors
- [ ] Verify no build warnings (critical ones)
- [ ] Test production build locally: `npm start`
- [ ] Deploy to Vercel
- [ ] Verify deployment successful
- [ ] Verify production URL accessible

### 15.5 Post-Deployment Verification
- [ ] Create new test account on production
- [ ] Run through basic workflow:
  - [ ] Create project
  - [ ] Draw pin, line, area
  - [ ] Upload file
  - [ ] Create plot
  - [ ] Verify data persists after logout/login
- [ ] Check browser console for errors
- [ ] Check Vercel logs for errors
- [ ] Check Supabase logs for errors

---

## 16. Known Issues to Monitor

Based on project history, pay special attention to:

### 16.1 Date Parsing
- [ ] Verify DD/MM/YYYY vs MM/DD/YYYY handling correct for all file types
- [ ] Verify 2-digit year expansion (25 → 2025)
- [ ] Verify discrete file date parsing (CROP, CHEM, WQ, EDNA)
- [ ] Check console for date parsing warnings

### 16.2 Marine Meteo Display
- [ ] Verify Marine Meteo files plot correctly
- [ ] Verify all parameters visible and selectable
- [ ] Verify no "missing parameter" errors
- [ ] Check console for Marine Meteo related errors

### 16.3 Plot Settings Restoration
- [ ] Verify saved plot views restore completely
- [ ] Verify compact view setting persists
- [ ] Verify custom Y-axis labels persist
- [ ] Verify moving average settings persist

### 16.4 RLS Policy Issues
- [ ] Verify no "RLS policy violation" errors in console
- [ ] Verify areas save/load correctly (recent RLS fixes)
- [ ] Verify files attach to pins correctly

---

## 17. User Acceptance Testing (UAT) Script

Provide this script to external testers:

### Quick Test Scenario (15 minutes)
1. Sign up for new account
2. Create new project named "Test Project"
3. Place 3 pins on map in different locations
4. Draw 1 line connecting 2 pins
5. Draw 1 area enclosing pins
6. Upload a CSV file to one pin (provide sample file)
7. Create a plot from uploaded data
8. Change pin color to blue
9. Change line style to dashed
10. Save plot view as "Test View"
11. Log out
12. Log back in
13. Restore session and verify all data present
14. Report any errors or unexpected behavior

### Things to Note During Testing
- Any error messages displayed
- Any console errors (F12 → Console tab)
- Page load times
- Map interaction smoothness
- Any confusing UI elements
- Any missing features or unclear workflows

---

## 18. Success Criteria

The application is ready for launch when:

- [ ] **All Section 1-8 tests pass** (core functionality)
- [ ] **All Section 9 tests pass** (performance)
- [ ] **All Section 10 tests pass** (data persistence)
- [ ] **All Section 11 tests pass** (error handling)
- [ ] **All Section 12 tests pass** (security)
- [ ] **All Section 15 tests pass** (pre-launch checklist)
- [ ] **Zero critical bugs** in browser console
- [ ] **Zero database errors** in Supabase logs
- [ ] **Zero build errors** in Vercel logs
- [ ] **At least 3 external users** complete UAT successfully

---

## Testing Log Template

Use this template to track your testing progress:

| Test Section | Status | Tested By | Date | Notes |
|--------------|--------|-----------|------|-------|
| 1. Authentication | ⬜ | | | |
| 2. Map Functionality | ⬜ | | | |
| 3. Data Upload | ⬜ | | | |
| 4. Data Visualization | ⬜ | | | |
| 5. Timeline | ⬜ | | | |
| 6. Project Management | ⬜ | | | |
| 7. Filter System | ⬜ | | | |
| 8. Data Explorer | ⬜ | | | |
| 9. Performance | ⬜ | | | |
| 10. Data Persistence | ⬜ | | | |
| 11. Error Handling | ⬜ | | | |
| 12. Security | ⬜ | | | |
| 13. Cross-Browser | ⬜ | | | |
| 14. Mobile | ⬜ | | | |
| 15. Pre-Launch | ⬜ | | | |

Legend: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

---

## Post-Launch Monitoring

After launch, monitor for 48 hours:

### Metrics to Track
- [ ] New user signups
- [ ] Authentication success rate
- [ ] File upload success rate
- [ ] Plot generation success rate
- [ ] Error rate (client-side)
- [ ] Error rate (server-side)
- [ ] Average page load time
- [ ] Average map interaction latency

### Where to Monitor
- **Vercel Dashboard**: Deployment status, function errors, analytics
- **Supabase Dashboard**: Database queries, storage usage, auth metrics
- **Browser Console**: Client-side errors (use error tracking service like Sentry)
- **User Feedback**: Collect via feedback form or email

### Incident Response
If critical issues discovered:
1. Check Vercel logs immediately
2. Check Supabase logs for database errors
3. Check browser console for client errors
4. Rollback deployment if necessary (Vercel makes this easy)
5. Fix issue and redeploy
6. Notify affected users

---

## Summary

This testing spec covers:
- ✅ 18 major test sections
- ✅ 200+ individual test cases
- ✅ Critical user workflows
- ✅ Performance benchmarks
- ✅ Security validation
- ✅ Pre-launch checklist
- ✅ UAT script for external testers
- ✅ Post-launch monitoring plan

**Estimated Testing Time:** 6-8 hours for comprehensive testing

**Recommendation:** Start with Sections 1-8 (core functionality), then 15 (pre-launch), then remaining sections.

Good luck with your launch! 🚀
