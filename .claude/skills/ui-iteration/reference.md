# UI Iteration - Extended Reference

## See Also
- [Playwright MCP Reference](../playwright-mcp-reference.md) - Shared API documentation
- [Skills System Guide](../SKILLS_GUIDE.md) - Overall architecture

## This Skill's Specifics

### Iteration Budget Strategy

**3-Cycle Maximum**:
- Cycle 1: Major structure/layout (save biggest issues)
- Cycle 2: Refinements (medium issues)
- Cycle 3: Polish (final touches)

**Token Budget Per Cycle**:
- Cycle 1: ~1500 tokens (biggest changes)
- Cycle 2: ~1200 tokens (refinements)
- Cycle 3: ~1000 tokens (polish)
- Total: ~3700 tokens (within Sonnet budget)

### Early Exit Optimization
If target achieved in 2 cycles:
```
Cycle 1: ✅ Major issues fixed
Cycle 2: ✅ Looks perfect
🎉 Done early - saved 1000 tokens!
```

### Visual Comparison Techniques
When user provides mockup:
1. Screenshot current state
2. Identify 3-5 key differences
3. Prioritize (structure → layout → visual)
4. Fix in order of impact
5. Verify against mockup

### Example Differences to Catch
- Spacing: padding, margin, gaps
- Typography: size, weight, line-height
- Colors: exact hex matches
- Borders: width, color, radius
- Shadows: offset, blur, color
- Alignment: flexbox, grid positioning
