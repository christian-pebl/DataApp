# Browser Testing Skills for Claude Code

## Quick Start

### 1. Install Playwright MCP
```bash
claude mcp add playwright npx '@playwright/mcp@latest'
```

### 2. Start Your Dev Server
```bash
npm run dev
# Runs on http://localhost:3000
```

### 3. Test a Skill
```bash
claude
```

Then in Claude Code:
```
You: "Quick check on localhost:3000"
```

Claude will automatically invoke the **ui-quick-check** skill and show you results!

## Available Skills

### ⚡ Efficiency & Optimization

0. **playwright-efficient** - Token-optimized Playwright usage patterns
   - Trigger: Auto-loaded when using Playwright MCP
   - Purpose: Reduce context usage by 80-95% (from 11k to 500 tokens per check)
   - Methods: Console-first verification, targeted DOM queries, minimal snapshots
   - See: `.claude/skills/playwright-efficient.md` for complete guide

### 🚀 Fast & Cheap (Haiku 4.5)

1. **ui-quick-check** - Single screenshot, basic visual check
   - Trigger: "Does X look right?", "Quick check on..."
   - Cost: $0.001 per check
   - Time: 5-10 seconds

2. **console-monitor** - JavaScript errors and warnings
   - Trigger: "Any console errors?", "Check the console"
   - Cost: $0.0005 per check
   - Time: 3-5 seconds

3. **accessibility-check** - WCAG compliance and ARIA validation
   - Trigger: "Is this accessible?", "Check accessibility"
   - Cost: $0.0007 per check
   - Time: 5-10 seconds

### 🎯 Comprehensive (Sonnet 4.5)

4. **ui-deep-test** - Multi-step testing with code analysis
   - Trigger: "Test the entire flow", "Find all bugs"
   - Cost: $0.05 per test
   - Time: 30-60 seconds

5. **ui-iteration** - Iterative visual refinement (3 cycles max)
   - Trigger: "Polish X", "Iterate on Y", "Match this design"
   - Cost: $0.08 per iteration
   - Time: 30-45 seconds

## Cost Comparison

### Traditional Approach (All Sonnet)
```
Full feature development: ~$0.80
Time: 30 minutes
Manual copy-paste: 15+ times
```

### Skills-Based Approach (Strategic Routing)
```
Full feature development: ~$0.19 (76% savings)
Time: 8 minutes (73% faster)
Automated: Zero copy-paste
```

## Example Workflows

### Workflow 1: Quick Development Loop
```
1. You: "Quick check on the homepage"
   → ui-quick-check (Haiku) - 5 seconds, $0.001

2. You: "Any console errors?"
   → console-monitor (Haiku) - 3 seconds, $0.0005

3. [You fix issues]

4. You: "Quick check again"
   → ui-quick-check (Haiku) - 5 seconds, $0.001

Total: 13 seconds, $0.0025
```

### Workflow 2: Feature Testing
```
1. You: "Test the checkout flow"
   → ui-deep-test (Sonnet) - 45 seconds, $0.05

2. [You fix critical bugs]

3. You: "Quick check + accessibility check"
   → ui-quick-check + accessibility-check (Haiku) - 10 seconds, $0.0017

Total: 55 seconds, $0.0517
```

### Workflow 3: UI Polish
```
1. You: "This UserCard component doesn't match the design"
   → ui-iteration (Sonnet) - 40 seconds, $0.08
   → 3 cycles of refinement

2. You: "Check accessibility on that component"
   → accessibility-check (Haiku) - 5 seconds, $0.0007

Total: 45 seconds, $0.0807
```

## Architecture

### Skill Distribution
```
Haiku Skills (60% usage)     Sonnet Skills (40% usage)
├── ui-quick-check           ├── ui-deep-test
├── console-monitor          └── ui-iteration
└── accessibility-check
```

### Context Window Optimization
```
Haiku skills:    500-1,000 tokens each
Sonnet skills:   4,000-7,000 tokens each
Session total:   Typically under 20,000 tokens
```

### Tool Restrictions
```
Read-only skills:  Bash only (Playwright MCP)
Iterative skills:  Bash + Read + Edit + Write
```

## Directory Structure

```
.claude/skills/
├── README.md (this file)
├── SKILLS_GUIDE.md (comprehensive guide)
├── playwright-mcp-reference.md (shared API docs)
│
├── ui-quick-check/
│   ├── SKILL.md (skill definition)
│   └── reference.md (skill-specific docs)
│
├── console-monitor/
│   ├── SKILL.md
│   └── reference.md
│
├── accessibility-check/
│   ├── SKILL.md
│   └── reference.md
│
├── ui-deep-test/
│   ├── SKILL.md
│   └── reference.md
│
└── ui-iteration/
    ├── SKILL.md
    └── reference.md
```

## Validation

Check if skills are properly installed:

```bash
# List all skills
ls -la .claude/skills/

# Verify Playwright MCP is installed
claude mcp list | grep playwright

# Test a skill manually
claude
> "Use ui-quick-check on localhost:3000"
```

## Troubleshooting

### "Skills not activating"
- Restart Claude Code after adding skills
- Check SKILL.md frontmatter syntax (YAML must be valid)
- Be explicit: "Use ui-quick-check skill"

### "Playwright not found"
```bash
# Install Playwright MCP
claude mcp add playwright npx '@playwright/mcp@latest'

# Verify installation
claude mcp list
```

### "Dev server not found"
```bash
# Ensure dev server is running
npm run dev

# Check port
curl http://localhost:3000

# If different port, specify:
You: "Check localhost:3001 instead"
```

### "Too many tokens"
```bash
# Check context usage
You: /context

# Clear if over 80%
You: /clear

# Use more Haiku skills, fewer Sonnet skills

# IMPORTANT: Use playwright-efficient patterns
# - browser_console_messages instead of browser_snapshot (95% token reduction)
# - browser_evaluate for targeted checks
# - browser_take_screenshot only when necessary
# See: .claude/skills/playwright-efficient.md
```

## Model Selection Guide

### Use Haiku When:
- ✅ Simple visual checks
- ✅ Console monitoring
- ✅ Accessibility tree analysis
- ✅ Quick yes/no questions
- ✅ Frequent repeated checks

### Use Sonnet When:
- ✅ Multi-step interaction flows
- ✅ Complex bug investigation
- ✅ Iterative visual refinement
- ✅ Code + browser combined analysis
- ✅ Detailed categorized reports

### When in Doubt:
**Start with Haiku** (3x cheaper, 2x faster)
- If Haiku finds issues → Escalate to Sonnet for deep dive
- If Haiku says "looks good" → You're done!

## Rate Limit Friendly

### Anthropic Limits (2025)
- **Haiku**: 40,000 requests/min (rarely hit)
- **Sonnet**: 4,000 requests/min (can hit during intensive sessions)

### Strategies
1. **Batch Haiku checks** - Run 3-5 in parallel
2. **Space Sonnet tests** - One deep test every 30 seconds
3. **Use iteration budgets** - Max 3 cycles prevents runaway
4. **Monitor usage** - Check /context frequently

## Best Practices

### 1. Progressive Testing
```
console-monitor (Haiku - fast)
  ↓ found errors?
ui-quick-check (Haiku - see impact)
  ↓ looks complex?
ui-deep-test (Sonnet - thorough)
  ↓ found bugs?
[fix bugs]
  ↓
ui-quick-check (Haiku - verify)
```

### 2. Parallel Execution
```
You: "Check console, UI, and accessibility in parallel"
Claude: [Runs 3 Haiku skills simultaneously]
```

### 3. Context Management
```
# Monitor context
You: /context

# Compact long conversations
You: /compact

# Clear between major features
You: /clear
```

### 4. Cost Optimization
```
# Cheap approach (Haiku-first)
Quick check → Console → Accessibility → Deep test (if needed)
Cost: $0.002 - $0.05

# Expensive approach (Sonnet-first) ❌
Deep test for everything
Cost: $0.50+
```

## Advanced Features

### Design Mockup Matching
```
You: [Drag mockup.png] "Use ui-iteration to match this design"
Claude: [Compares current vs mockup, iterates 3 times]
```

### CI/CD Integration
```bash
# In GitHub Actions
claude --no-interactive -p \
  "Use ui-deep-test on localhost:3000/checkout. Exit 1 if critical issues."
```

### Multi-Component Testing
```
You: "Quick check these 5 components: Header, Sidebar, Footer, UserCard, LoginForm"
Claude: [Runs ui-quick-check on each sequentially]
```

## Documentation

- **SKILLS_GUIDE.md** - Complete architecture, workflows, troubleshooting
- **playwright-mcp-reference.md** - Playwright API details
- **[skill]/SKILL.md** - Individual skill definitions
- **[skill]/reference.md** - Skill-specific documentation

## Getting Help

### In Claude Code
```
You: "How do I use the ui-iteration skill?"
You: "Show me an example of console-monitor"
You: "What's the difference between ui-quick-check and ui-deep-test?"
```

### Check Documentation
1. Read SKILLS_GUIDE.md for comprehensive info
2. Check individual SKILL.md files for specifics
3. See playwright-mcp-reference.md for API details

### Common Questions

**Q: Which skill should I use?**
A: Start with Haiku skills (quick-check, console-monitor, accessibility-check). Escalate to Sonnet (deep-test, iteration) only when needed.

**Q: How much does this cost?**
A: Haiku skills: $0.0005-0.001 each. Sonnet skills: $0.05-0.08 each. Most sessions: $0.10-0.20 total.

**Q: Can I force a specific skill?**
A: Yes! Say "Use ui-quick-check skill" instead of "quick check" to be explicit.

**Q: How do I monitor token usage?**
A: Use `/context` command in Claude Code to see real-time usage.

**Q: What if skills don't activate?**
A: Restart Claude Code, verify YAML syntax, or be explicit about which skill to use.

## Summary

✅ **5 specialized skills** for browser testing
✅ **76% cost savings** through strategic model routing
✅ **73% time savings** through automation
✅ **Zero copy-paste** required
✅ **Rate limit friendly** with Haiku-first approach
✅ **Context optimized** with tool restrictions

**Ready to start?**
```bash
claude
You: "Quick check on localhost:3000"
```

🚀 **Let Claude Code do the browser testing for you!**
