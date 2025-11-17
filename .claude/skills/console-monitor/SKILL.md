---
name: console-monitor
description: Monitor browser console for JavaScript errors, warnings, and network failures. Use when debugging runtime issues, checking for console errors, or monitoring application health. Ultra-lightweight, no screenshots.
allowed-tools: Bash
---

# Console Monitor Skill

## Purpose
**Ultra-fast console error detection** without screenshots or visual analysis. Optimized for Haiku 4.5 - fastest and cheapest model.

## When Claude Uses This
- User asks "any console errors?" or "check the console"
- Debugging JavaScript issues
- After code changes to verify no new errors
- Monitoring during development
- Quick health check of running application

## What This Skill Does

1. **Open Browser**: Navigate to specified localhost URL
2. **Monitor Console**: Listen for errors, warnings, network failures
3. **Interact (Optional)**: If user specifies, perform actions that might trigger errors
4. **Report**: List all console messages with severity

## Tool Usage
- **Playwright MCP ONLY**: Use browser console monitoring tools
- **No screenshots**: Console text only (saves massive tokens)
- **No code reads**: Just runtime monitoring
- **No DOM inspection**: Console messages only

## Efficiency Notes
- **Minimal context**: Console text is ~100-500 tokens vs 1000+ for screenshots
- **Super fast**: Runs in under 5 seconds
- **Haiku-optimized**: Simple text parsing, no image analysis
- **No file I/O**: Pure runtime monitoring

## Example Workflow

**User**: "Check console errors on localhost:3000"

**Skill Actions**:
```bash
# Use Playwright MCP console monitoring
1. Navigate to http://localhost:3000
2. Listen for console events (errors, warnings, network)
3. Wait 3-5 seconds for page to stabilize
4. Report all console messages
```

**Output Format**:
```
Console Monitoring: http://localhost:3000

🔴 ERRORS (2):
1. TypeError: Cannot read property 'map' of undefined
   at UserList.tsx:45:12
   at renderWithHooks (react-dom.js:...)

2. Failed to load resource: net::ERR_FAILED
   URL: http://localhost:3000/api/users
   Status: 404

🟡 WARNINGS (1):
1. Warning: Each child in a list should have a unique "key" prop
   at UserCard (UserCard.tsx:12)

⚪ INFO (3):
- React DevTools loaded
- Service Worker registered
- API cache initialized

Network Failed Requests: 1
- GET /api/users → 404 Not Found
```

## Advanced: Interactive Monitoring

**User**: "Check console when I click the submit button"

```bash
1. Navigate to page
2. Start console monitoring
3. Click specified element
4. Wait for async operations
5. Report new console messages
```

## Context Budget
- **Target**: 200-500 tokens per run
- **Max**: 1,000 tokens (even with many errors)
- **How**: Console text is minimal compared to screenshots

## Anti-Patterns (DON'T)
- ❌ Don't take screenshots (use ui-quick-check if visual needed)
- ❌ Don't read source files to analyze errors (use ui-deep-test for that)
- ❌ Don't suggest fixes (just report what's in console)
- ❌ Don't test multiple pages (one URL per run)

## Success Criteria
- ✅ Under 5 seconds execution time
- ✅ Under 500 tokens context usage
- ✅ All console messages captured
- ✅ Errors categorized by severity
- ✅ Stack traces included (when available)

## Complementary Skills
- **Found errors?** → Use `ui-deep-test` to investigate root cause
- **Need visual confirmation?** → Use `ui-quick-check` to see UI
- **Want to fix errors?** → Main Claude session with file editing
