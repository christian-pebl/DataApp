# Console Monitor - Extended Reference

## See Also
- [Playwright MCP Reference](../playwright-mcp-reference.md) - Shared API documentation
- [Skills System Guide](../SKILLS_GUIDE.md) - Overall architecture

## This Skill's Specifics

### Why This is Haiku-Optimized
- No screenshots (text only)
- Simple parsing (errors vs warnings)
- Linear output (no complex reasoning)
- 300-500 tokens typical

### Console Message Types
- 🔴 **error**: JavaScript errors, failed assertions
- 🟡 **warning**: React warnings, deprecated API usage
- 🔵 **info**: General logs
- ⚪ **log**: console.log() output
- 🟣 **debug**: Verbose debugging

### Network Failure Detection
Also monitors:
- 404 errors (missing resources)
- 500 errors (server failures)
- CORS errors
- Timeout errors

### Example Output
```
🔴 TypeError: Cannot read 'map' of undefined
   at UserList.tsx:45
🟡 Warning: Each child needs a key prop
   at UserCard.tsx:12
```
