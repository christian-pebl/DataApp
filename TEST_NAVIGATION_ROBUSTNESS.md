# Navigation Robustness Test Plan

## Overview
This document outlines tests to verify that the TopNavigation component is rock-solid and never disappears under any circumstances.

## Test Scenarios

### 1. Basic Functionality
- [ ] Navigate to application (http://localhost:3009)
- [ ] Verify PEBL logo is visible and clickable
- [ ] Check that navigation bar maintains consistent height (h-14)
- [ ] Verify navigation bar stays at top (sticky positioning)

### 2. Authentication State Transitions
- [ ] **Logged Out State**: Verify logo is visible, no user menu appears
- [ ] **Login Process**: 
  - Navigate to /auth
  - Log in with valid credentials
  - Verify navigation stays visible during login process
  - Verify user menu appears after successful login
  - Verify logo remains visible throughout
- [ ] **Logout Process**:
  - Click user menu and select "Sign out"
  - Verify navigation stays visible during logout
  - Verify navigation redirects to /auth
  - Verify logo remains visible throughout

### 3. Network Issues
- [ ] **Slow Network**: Throttle connection and test login/logout
- [ ] **Intermittent Connection**: Disable/enable network during auth changes
- [ ] **Supabase Service Unavailable**: Test with invalid API keys

### 4. Error Conditions
- [ ] **JavaScript Errors**: Introduce console errors and verify navigation persists
- [ ] **Component Errors**: Test with broken UserMenu component
- [ ] **Auth Service Errors**: Test with Supabase connection issues

### 5. Hydration and SSR/CSR
- [ ] **Hard Refresh**: Refresh page while logged in, verify navigation appears correctly
- [ ] **Direct Navigation**: Navigate directly to protected routes
- [ ] **Browser Back/Forward**: Use browser navigation extensively

### 6. Rapid State Changes
- [ ] **Quick Login/Logout**: Rapidly log in and out multiple times
- [ ] **Multiple Tabs**: Test auth state changes across multiple tabs
- [ ] **Session Expiry**: Test behavior when session expires

## Expected Behaviors

### Navigation Structure Should ALWAYS Include:
1. **Navigation Container**: Sticky nav element with consistent styling
2. **PEBL Logo**: Always visible on the left side, clickable, proper styling
3. **Right Side**: Either user menu (when authenticated) or empty space (when not)
4. **Consistent Height**: 56px (h-14) maintained in all states
5. **Error Resilience**: Navigation renders even when errors occur

### Fallback Behaviors:
- **Loading State**: Show skeleton with logo while auth initializes
- **Error State**: Show basic navigation with logo, no user menu
- **Pre-hydration**: Show server-rendered navigation until hydration completes
- **Network Issues**: Maintain navigation structure, handle auth gracefully

## Implementation Features

### Robustness Measures Implemented:
1. **Multiple Error Boundaries**: Both general and navigation-specific
2. **Hydration Protection**: Separate handling for pre/post hydration
3. **Graceful Degradation**: Always render core navigation structure
4. **Loading States**: Skeleton UI during state transitions
5. **Error Recovery**: Comprehensive try/catch blocks
6. **State Management**: Robust auth state handling with fallbacks

### Key Components:
- `TopNavigation.tsx` - Main component with robust error handling
- `NavigationErrorBoundary.tsx` - Dedicated error boundary
- `layout.tsx` - Server-side user fetching with error handling
- Enhanced `UserMenu.tsx` - Better error handling for sign out

## Manual Testing Checklist

1. **Start Fresh Session**:
   - Clear browser data
   - Navigate to app
   - Verify logo visible

2. **Authentication Flow**:
   - Sign in → verify navigation persists
   - Navigate between pages → verify navigation persists  
   - Sign out → verify navigation persists
   - Repeat 5+ times rapidly

3. **Error Simulation**:
   - Open DevTools
   - Introduce network errors
   - Break localStorage/cookies
   - Verify navigation always visible

4. **Edge Cases**:
   - Refresh during login
   - Close/reopen browser tabs
   - Modify auth tokens manually
   - Test with ad blockers

## Success Criteria

✅ **PASS**: Navigation (including PEBL logo) is visible in 100% of tested scenarios
❌ **FAIL**: Navigation disappears or becomes broken in any scenario

The navigation should be virtually indestructible - no matter what happens with auth, network, errors, or user actions, the PEBL logo and navigation structure should always remain visible and functional.