# Test Credentials Documentation

## Overview
This document describes the test credentials stored for automated and manual testing of the authentication system.

## Security Notice
⚠️ **IMPORTANT**: The `test-credentials.json` file contains real passwords and should NEVER be committed to version control. It is already added to `.gitignore`.

## Available Test Users

### User 1 - Primary Test Account
- **Email**: `christiannberger@gmail.com`
- **Password**: `Mewslade123@`
- **Purpose**: Primary test user for general testing
- **Status**: Active

### User 2 - Secondary Test Account  
- **Email**: `christian@pebl-cic.co.uk`
- **Password**: `Mewslade123@`
- **Purpose**: Secondary user for multi-user testing scenarios
- **Status**: Active

## File Structure

```
data-app-sep25/
├── test-credentials.json       # Stores user credentials (git-ignored)
├── test-helpers.js             # Helper functions for testing
├── example-multi-user-test.js  # Example test using the credentials
└── TEST_CREDENTIALS_README.md  # This file
```

## Usage Examples

### Manual Testing
1. Navigate to http://localhost:9002/auth
2. Use any of the test credentials above
3. Test login/logout functionality

### Automated Testing with Playwright

```javascript
const { getTestUser, loginWithUser } = require('./test-helpers');

// Get a test user
const user = getTestUser('christiannberger@gmail.com');

// Login with the user
await loginWithUser(page, user);
```

### Multi-User Testing

```javascript
const { switchUser } = require('./test-helpers');

// Switch between users
await switchUser(page, user1, user2);
```

## Available Helper Functions

- `loadTestCredentials()` - Load all test credentials
- `getTestUser(identifier)` - Get specific user by email or ID
- `getAllTestUsers()` - Get array of all test users
- `loginWithUser(page, user)` - Login with specific user
- `logout(page)` - Logout current user
- `switchUser(page, fromUser, toUser)` - Switch between users

## Running Tests

```bash
# Run example multi-user test
cd data-app-sep25
node example-multi-user-test.js

# Run login error capture
node test-real-login.js
```

## Maintenance

- Update `test-credentials.json` when passwords change
- Keep this README updated with any new test users
- Ensure `.gitignore` always includes credential files

## Contact
For questions about test credentials or to request new test accounts, contact the development team.

---
Last Updated: January 9, 2025