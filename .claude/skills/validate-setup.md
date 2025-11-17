# Skills Setup Validation

## ✅ Installation Status

### Skills Directory
- ✅ `.claude/skills/` directory exists
- ✅ 5 skills installed:
  - ✅ ui-quick-check (Haiku)
  - ✅ console-monitor (Haiku)
  - ✅ accessibility-check (Haiku)
  - ✅ ui-deep-test (Sonnet)
  - ✅ ui-iteration (Sonnet)

### Playwright MCP
- ✅ Playwright MCP installed
- ✅ Connection status: Connected
- ✅ Command: `npx @playwright/mcp@latest`

### Development Server
- ✅ Dev server running
- ✅ Port: 9002
- ✅ Command: `npm run dev`

## 🚀 Quick Test Commands

### Test in Claude Code

Start a new Claude Code session and try these:

```
1. Quick Visual Check:
   "Quick check on localhost:9002"
   → Should invoke ui-quick-check skill with Haiku

2. Console Monitor:
   "Any console errors on localhost:9002?"
   → Should invoke console-monitor skill with Haiku

3. Accessibility Check:
   "Is localhost:9002 accessible?"
   → Should invoke accessibility-check skill with Haiku

4. Deep Test (when needed):
   "Test the entire map-drawing flow on localhost:9002/map-drawing"
   → Should invoke ui-deep-test skill with Sonnet

5. UI Iteration (when needed):
   "Iterate on the LeafletMap component to improve styling"
   → Should invoke ui-iteration skill with Sonnet
```

## 📊 Expected Behavior

### Auto-Selection Examples

| Your Prompt | Skill Invoked | Model | Why |
|-------------|---------------|-------|-----|
| "Quick check homepage" | ui-quick-check | Haiku | Keywords: "quick", "check" |
| "Any errors?" | console-monitor | Haiku | Keywords: "errors" |
| "Is this accessible?" | accessibility-check | Haiku | Keywords: "accessible" |
| "Test the flow" | ui-deep-test | Sonnet | Keywords: "test", "flow" |
| "Polish component" | ui-iteration | Sonnet | Keywords: "polish" |

### Cost per Check

- **ui-quick-check**: ~$0.001 (1 screenshot + analysis)
- **console-monitor**: ~$0.0005 (console text only)
- **accessibility-check**: ~$0.0007 (a11y tree)
- **ui-deep-test**: ~$0.05 (multi-step + code analysis)
- **ui-iteration**: ~$0.08 (3 cycles of refinement)

## 🧪 Validation Workflow

### Step 1: Start Claude Code
```bash
claude
```

### Step 2: Test Quick Check
```
You: "Quick check on localhost:9002"
```

**Expected Output**:
```
[Claude invokes ui-quick-check skill]
[Playwright opens browser to localhost:9002]
[Takes screenshot]
[Analyzes visually]

✓ Page renders correctly
✓ Map component visible
✓ Navigation elements present
! Minor: [any issues found]

Time: ~5 seconds
Cost: ~$0.001
Tokens: ~1200
```

### Step 3: Test Console Monitor
```
You: "Check console for errors"
```

**Expected Output**:
```
[Claude invokes console-monitor skill]
[Playwright connects to localhost:9002]
[Monitors console events]

Console Report:
🔴 ERRORS: [list if any]
🟡 WARNINGS: [list if any]
⚪ INFO: [list if any]

Time: ~3 seconds
Cost: ~$0.0005
Tokens: ~300
```

### Step 4: Test Accessibility
```
You: "Is the homepage accessible?"
```

**Expected Output**:
```
[Claude invokes accessibility-check skill]
[Playwright gets accessibility tree]

Accessibility Report:
✅ Passed: [list]
⚠️ Warnings: [list]
🔴 Errors: [list]

WCAG Level A: [status]
WCAG Level AA: [status]

Time: ~5 seconds
Cost: ~$0.0007
Tokens: ~400
```

## 🔍 Troubleshooting

### Skill Not Activating

**Symptom**: Claude doesn't use skills, just responds normally

**Solutions**:
1. Restart Claude Code (skills load on startup)
2. Be more explicit: "Use ui-quick-check skill on localhost:9002"
3. Check SKILL.md files have valid YAML frontmatter

### Playwright Connection Issues

**Symptom**: "Cannot connect to Playwright MCP"

**Solutions**:
```bash
# Verify MCP is installed
claude mcp list

# Should show:
# playwright: npx @playwright/mcp@latest - ✓ Connected

# If not connected, reinstall:
claude mcp remove playwright
claude mcp add playwright npx "@playwright/mcp@latest"
```

### Dev Server Issues

**Symptom**: "Cannot navigate to localhost:9002"

**Solutions**:
```bash
# Check if running
netstat -ano | findstr ":9002"

# If not running, start it
npm run dev

# Verify it responds
curl http://localhost:9002
```

### High Token Usage

**Symptom**: Context window filling up quickly

**Solutions**:
```bash
# In Claude Code:
/context  # Check usage

# If over 80%:
/clear    # Reset context

# Best practices:
# - Use Haiku skills (quick-check, console-monitor, a11y-check) for 90% of checks
# - Use Sonnet skills (deep-test, iteration) only when needed
# - Parallel Haiku checks: "Check console, UI, and accessibility"
```

## 📈 Success Metrics

Track these over 1 week:

### Before Skills
- ❌ Manual copy-paste: 15+ times per feature
- ❌ Time: 30 min per feature
- ❌ Cost: ~$0.80 per feature
- ❌ Context: 80,000+ tokens

### After Skills (Target)
- ✅ Manual copy-paste: 0
- ✅ Time: 8 min per feature (73% faster)
- ✅ Cost: ~$0.19 per feature (76% cheaper)
- ✅ Context: 18,000 tokens (single session)

## 🎯 Next Steps

1. **Test each skill** using commands above
2. **Monitor usage** with `/context` command
3. **Track savings** (time + cost)
4. **Refine workflows** based on your patterns
5. **Share with team** (skills are in git)

## 📚 Documentation

- **Quick Start**: `.claude/skills/README.md`
- **Setup Guide**: `.claude/skills/INSTALLATION_COMPLETE.md`
- **ROI Analysis**: `.claude/skills/EXECUTIVE_SUMMARY.md`
- **Deep Dive**: `.claude/skills/SKILLS_GUIDE.md`
- **API Reference**: `.claude/skills/playwright-mcp-reference.md`

## ✅ Validation Checklist

- [x] Skills directory exists with 5 skills
- [x] Playwright MCP installed and connected
- [x] Dev server running on port 9002
- [ ] Tested ui-quick-check skill
- [ ] Tested console-monitor skill
- [ ] Tested accessibility-check skill
- [ ] Tested ui-deep-test skill (optional)
- [ ] Tested ui-iteration skill (optional)

---

**Status**: ✅ Setup Complete - Ready to Test!

**Your dev server**: http://localhost:9002

**Test command**:
```bash
claude
You: "Quick check on localhost:9002"
```
