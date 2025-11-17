# Browser Testing Skills - Complete Guide

## Overview

This skills system provides **5 specialized browser testing capabilities** optimized for cost, speed, and context efficiency. Each skill uses Playwright MCP but targets different use cases with different model requirements.

## Quick Reference

| Skill | Speed | Cost | Model | Use When |
|-------|-------|------|-------|----------|
| **ui-quick-check** | ⚡⚡⚡ | $ | Haiku | "Does this look right?" |
| **console-monitor** | ⚡⚡⚡ | $ | Haiku | "Any console errors?" |
| **accessibility-check** | ⚡⚡⚡ | $ | Haiku | "Is this accessible?" |
| **ui-iteration** | ⚡⚡ | $$$ | Sonnet | "Polish this component" |
| **ui-deep-test** | ⚡ | $$$$ | Sonnet | "Test the entire flow" |

**Cost Key**: $ = Haiku ($1/$5), $$$ = Sonnet ($3/$15)

## Architecture Principles

### 1. **Model-Specific Design**
Each skill is designed for a specific Claude model tier:
- **Haiku-optimized**: Simple, single-task, text-heavy
- **Sonnet-optimized**: Complex, multi-step, reasoning-heavy

### 2. **Context Budget Management**
Every skill has a token budget:
- **Haiku skills**: 500-1,000 tokens max
- **Sonnet skills**: 4,000-7,000 tokens max
- **How achieved**: Tool restrictions, no unnecessary file reads, strategic screenshot usage

### 3. **Progressive Disclosure**
Skills load reference documentation (playwright-mcp-reference.md) only when needed, keeping base context minimal.

### 4. **Tool Restrictions**
`allowed-tools` prevents unnecessary file reads:
- **Read-only skills**: Only Bash (for Playwright)
- **Iterative skills**: Bash + Read + Edit

### 5. **Complementary Design**
Skills work together in workflows:
```
console-monitor → finds errors
  ↓
ui-quick-check → sees visual impact
  ↓
ui-deep-test → investigates thoroughly
  ↓
ui-iteration → fixes and polishes
  ↓
accessibility-check → verifies compliance
```

## Usage Patterns

### Pattern 1: Quick Development Loop (Haiku-Only)

**Scenario**: Rapid UI development with hot reload

```
You: "npm run dev is running. Quick check on the homepage."
Claude: [Invokes ui-quick-check skill]
        ✓ Homepage renders correctly
        ✓ Navigation visible and styled
        ! Minor: Hero image aspect ratio slightly off

You: "Check console for errors"
Claude: [Invokes console-monitor skill]
        🔴 1 ERROR: Failed to load /api/featured-products (404)

You: [Fix the API route]

You: "Quick check again"
Claude: [Invokes ui-quick-check skill]
        ✓ All looks good now
```

**Cost**: ~3 Haiku calls = $0.003 for entire session
**Time**: ~15-20 seconds total
**Context**: ~2,000 tokens

### Pattern 2: Feature Completion (Mixed Models)

**Scenario**: New feature needs thorough testing

```
You: "Test the new checkout flow at /checkout"
Claude: [Invokes ui-deep-test skill with Sonnet]
        Found 2 critical issues:
        1. Payment validation fails [details]
        2. Confirmation page doesn't load [details]

You: [Fix both issues]

You: "Quick check to verify fixes"
Claude: [Invokes ui-quick-check skill with Haiku]
        ✓ Checkout flow visually correct

You: "Check accessibility"
Claude: [Invokes accessibility-check skill with Haiku]
        ⚠️ 3 ARIA issues found [details]

You: [Fix ARIA issues]

You: "Final check"
Claude: [Invokes console-monitor + accessibility-check in parallel]
        ✅ No console errors
        ✅ Accessibility checks passed
```

**Cost**: 1 Sonnet deep test ($0.05) + 3 Haiku checks ($0.003) = ~$0.053
**Time**: ~2 minutes total
**Context**: ~8,000 tokens

### Pattern 3: UI Polish (Sonnet Iteration)

**Scenario**: Component looks "off" and needs refinement

```
You: "The UserCard component doesn't match the design. Iterate on it."
Claude: [Invokes ui-iteration skill with Sonnet]

        Cycle 1: Fixed spacing and alignment
        Cycle 2: Corrected colors and borders
        Cycle 3: Added subtle shadows and polish

        ✅ Component now matches design mockup
        Files modified: UserCard.tsx, styles.module.css

You: "Quick accessibility check on that component"
Claude: [Invokes accessibility-check skill with Haiku]
        ✅ All accessibility checks passed
```

**Cost**: 1 Sonnet iteration ($0.08) + 1 Haiku a11y check ($0.001) = ~$0.081
**Time**: ~45 seconds
**Context**: ~7,500 tokens

## Cost Analysis

### Scenario: Full Feature Development

**Without Skills (Manual Copy-Paste)**:
- 15 manual copy-pastes of console logs
- 10 screenshot drag-drops
- 5 code review cycles
- All using main Sonnet session
- **Cost**: ~$0.80 (all Sonnet tokens)
- **Time**: 30 minutes
- **Context**: 80,000+ tokens (multiple /clear needed)

**With Skills (Optimized Routing)**:
- 2 deep tests (Sonnet): $0.10
- 8 quick checks (Haiku): $0.008
- 3 console monitors (Haiku): $0.003
- 2 accessibility checks (Haiku): $0.002
- 1 iteration (Sonnet): $0.08
- **Cost**: ~$0.19 (76% savings)
- **Time**: 8 minutes (73% faster)
- **Context**: 18,000 tokens (stay in single session)

**ROI**: 4x cheaper, 4x faster, cleaner context

## Best Practices

### 1. Start Cheap, Escalate Smart
```
✅ DO: console-monitor → ui-quick-check → ui-deep-test (if needed)
❌ DON'T: ui-deep-test for everything
```

### 2. Use Parallel Skills When Independent
```
You: "Check console errors and accessibility in parallel"
Claude: [Runs console-monitor + accessibility-check simultaneously]
```

### 3. Reuse Browser Sessions
Skills automatically reuse browser when possible:
```
ui-quick-check → browser opens
console-monitor → reuses same browser (faster)
ui-quick-check → still reuses (no reconnection delay)
```

### 4. Match Skill to Task Complexity

**Simple → Haiku Skills**:
- ✅ "Does X look right?"
- ✅ "Any errors?"
- ✅ "Is Y accessible?"

**Complex → Sonnet Skills**:
- ✅ "Test the entire flow"
- ✅ "Polish this component"
- ✅ "Find all bugs in X feature"

### 5. Leverage Tool Restrictions
Skills with `allowed-tools: Bash` only:
- Cannot accidentally read/modify files
- Faster execution (no file system scanning)
- Lower context usage

### 6. Monitor Your Context Budget
```
You: /context
```
Check which skills are using tokens. If over 80%:
- Use `/clear` between major tasks
- Prefer Haiku skills for routine checks
- Use `/compact` to summarize long conversations

## Rate Limit Management

### Anthropic Rate Limits (2025)

**Haiku 4.5**:
- 40,000 requests per minute
- 4,000,000 tokens per minute
- **Rarely hit limits** (ultra-fast, cheap)

**Sonnet 4.5**:
- 4,000 requests per minute
- 400,000 tokens per minute
- **Can hit limits** during intensive sessions

### Strategies to Avoid Limits

**1. Batch Haiku Checks**
```
You: "Run console-monitor, accessibility-check, and ui-quick-check on /dashboard"
Claude: [All three Haiku skills in parallel - uses 3 Haiku calls, not Sonnet]
```

**2. Space Out Sonnet Deep Tests**
```
✅ DO: Quick checks between deep tests
❌ DON'T: 10 ui-deep-tests in a row
```

**3. Use Iteration Budget Wisely**
ui-iteration skill has max 3 cycles built-in:
- Prevents runaway loops
- Each cycle is strategic
- Stops early if target met

**4. Monitor Usage**
```bash
# Check recent API usage
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/messages | jq '.usage'
```

## Troubleshooting

### "Skill not activating"

**Check description match**:
```
You: "test the UI" → Might invoke ui-quick-check or ui-deep-test
You: "thoroughly test the UI flow" → Will invoke ui-deep-test
```

**Solution**: Be explicit
```
You: "Use ui-quick-check skill to see the homepage"
```

### "Too many tokens"

**Symptom**: Context window filling up quickly

**Causes**:
- Using ui-deep-test for every check
- Not using /clear between tasks
- MCP servers adding context

**Solutions**:
```
# 1. Check context usage
You: /context

# 2. Clear if over 80%
You: /clear

# 3. Disable unused MCP servers
You: /mcp
# Disable servers not needed right now

# 4. Use Haiku skills more
You: "Quick check instead of deep test"
```

### "Playwright not found"

**Issue**: MCP server not installed

**Solution**:
```bash
claude mcp add playwright npx '@playwright/mcp@latest'
```

### "Browser timeout"

**Issue**: Dev server not running or wrong port

**Solution**:
```bash
# Check dev server
npm run dev

# Verify port
curl http://localhost:3000

# If different port
You: "Check localhost:3001 instead"
```

## Advanced Workflows

### Continuous Integration Mode

Run skills from CI/CD:
```bash
# In GitHub Actions
claude --no-interactive -p "Use ui-deep-test to test /checkout flow on localhost:3000. Exit code 1 if critical issues found."
```

### Multi-Component Testing

Test multiple components efficiently:
```
You: "Check 5 components: Header, Sidebar, UserCard, Footer, LoginForm"

Claude: [Runs ui-quick-check on each sequentially]
        Header: ✅
        Sidebar: ✅
        UserCard: ⚠️ Minor spacing issue
        Footer: ✅
        LoginForm: ✅

You: "Iterate on UserCard to fix spacing"
Claude: [Runs ui-iteration on just UserCard]
```

### Design Mockup Matching

Provide target screenshot:
```
You: [Drag mockup.png] "Use ui-iteration to match this design for the UserProfile component"

Claude: [ui-iteration skill]
        Analyzing mockup...
        Cycle 1: Restructured layout
        Cycle 2: Matched colors and fonts
        Cycle 3: Added finishing touches
        ✅ Component now matches mockup
```

## Model Selection Strategy

### Decision Tree

```
START: Need browser testing?
  ↓
Simple visual check? → ui-quick-check (Haiku)
  ↓
Just console errors? → console-monitor (Haiku)
  ↓
Just accessibility? → accessibility-check (Haiku)
  ↓
Multiple iterations needed? → ui-iteration (Sonnet)
  ↓
Complex flow testing? → ui-deep-test (Sonnet)
```

### When in Doubt

**Default to Haiku first**:
```
You: "Not sure if there are issues with the form"
Claude: [Runs console-monitor + ui-quick-check with Haiku]
        No obvious issues found
```

**Escalate to Sonnet if needed**:
```
You: "Hmm, users report problems. Deep test the form."
Claude: [Runs ui-deep-test with Sonnet]
        Found subtle validation bug in edge case...
```

## Context Window Optimization

### Token Budget by Skill

| Skill | Avg Tokens | Max Tokens | Main Cost |
|-------|-----------|-----------|-----------|
| console-monitor | 300 | 1,000 | Console text |
| accessibility-check | 400 | 1,000 | A11y tree |
| ui-quick-check | 1,200 | 2,000 | 1 screenshot |
| ui-iteration | 6,000 | 8,000 | 4-6 screenshots |
| ui-deep-test | 5,000 | 10,000 | Code + screenshots |

### Cumulative Session Example

```
Session Start: 0 tokens

+ console-monitor: +300 tokens → 300 total
+ ui-quick-check: +1200 tokens → 1,500 total
+ [user fixes code]: +500 tokens → 2,000 total
+ console-monitor: +300 tokens → 2,300 total
+ ui-quick-check: +1200 tokens → 3,500 total
+ accessibility-check: +400 tokens → 3,900 total

✅ Session under 4,000 tokens - plenty of room left
```

### When to /clear

**Safe Thresholds**:
- Under 40,000 tokens: Keep going
- 40,000-80,000 tokens: Start /compact
- 80,000-160,000 tokens: Consider /clear between major tasks
- Over 160,000 tokens: /clear recommended

**Check anytime**:
```
You: /context
```

## Summary

### Key Takeaways

1. **5 skills = Complete browser testing suite**
   - 3 Haiku skills for speed/cost
   - 2 Sonnet skills for complexity

2. **76% cost savings** vs all-Sonnet approach
   - Strategic model routing
   - Token-optimized designs

3. **73% time savings** vs manual copy-paste
   - Automated browser interaction
   - Parallel skill execution

4. **Cleaner context windows**
   - Tool restrictions
   - Progressive disclosure
   - Focused skill scopes

5. **Rate limit friendly**
   - Haiku handles 95% of checks
   - Sonnet only for complex tasks

### Quick Start

```bash
# 1. Install Playwright MCP (if not done)
claude mcp add playwright npx '@playwright/mcp@latest'

# 2. Start your dev server
npm run dev

# 3. Try your first skill
claude
You: "Quick check on localhost:3000"
# Claude invokes ui-quick-check automatically

# 4. Monitor context
You: /context
```

### Next Steps

- Read individual SKILL.md files for deep dives
- Check playwright-mcp-reference.md for API details
- Experiment with parallel skill execution
- Monitor your token/cost usage with /context

---

**Questions?** Check the troubleshooting section or ask Claude:
```
You: "How do I use ui-iteration skill?"
```
