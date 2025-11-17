# UI Deep Test - Extended Reference

## See Also
- [Playwright MCP Reference](../playwright-mcp-reference.md) - Shared API documentation
- [Skills System Guide](../SKILLS_GUIDE.md) - Overall architecture

## This Skill's Specifics

### When to Use Sonnet
This skill requires Sonnet 4.5 because:
- Multi-step reasoning (test flows)
- Code analysis + browser testing
- Categorizing bugs by severity
- Suggesting specific fixes with file paths

### Test Flow Template
```
1. Understand (read 2-3 files)
2. Test (5-7 screenshots max)
3. Analyze (console + network + DOM)
4. Report (structured findings)
```

### Example Prompts
- "Test the entire checkout process"
- "Find all bugs in the user registration flow"
- "Thoroughly test the data visualization dashboard"

### Budget Control
- Max 7 screenshots (each ~1000 tokens)
- Max 3 file reads (each ~500 tokens)
- Total target: 5,000 tokens
