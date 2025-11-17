# UI Quick Check - Extended Reference

## See Also
- [Playwright MCP Reference](../playwright-mcp-reference.md) - Shared API documentation
- [Skills System Guide](../SKILLS_GUIDE.md) - Overall architecture

## This Skill's Specifics

### Optimizations for Haiku
- Single screenshot only (minimize tokens)
- No file reads (stay focused on browser)
- 2-3 sentence output (concise)
- No code suggestions (just observations)

### Example Prompts That Trigger This
- "Quick check on the homepage"
- "Does the login form look right?"
- "Take a look at localhost:3000/dashboard"
- "Visual check on the UserCard component"

### What Disqualifies This Skill
- "Thoroughly test..." → Use ui-deep-test
- "Iterate on..." → Use ui-iteration
- "Check console errors..." → Use console-monitor
- "Is this accessible..." → Use accessibility-check
