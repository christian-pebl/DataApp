---
name: ui-quick-check
description: Fast visual spot-check of UI components. Use for simple "does this look right?" questions, basic layout verification, or quick screenshot analysis. Ideal for rapid iteration. Uses Playwright MCP for single screenshot capture without deep analysis.
allowed-tools: Bash
---

# UI Quick Check Skill

## Purpose
Perform **fast, lightweight visual checks** of UI components without extensive analysis. Optimized for speed and cost-efficiency.

## When Claude Uses This
- User asks "does this look right?" or "take a quick look at..."
- Simple verification tasks (component rendered, colors correct, text visible)
- Rapid iteration cycles during development
- Checking specific UI elements (button, form, card, etc.)

## What This Skill Does

1. **Single Screenshot**: Takes ONE screenshot of specified page/component
2. **Basic Visual Analysis**: Quick check for obvious issues:
   - Is component visible?
   - Are colors/spacing roughly correct?
   - Any obvious layout breaks?
   - Text readable?
3. **Report**: Concise 2-3 sentence assessment

## Tool Usage
- **Playwright MCP**: Navigate to localhost URL, take single screenshot
- **No code changes**: Read-only analysis only
- **No interaction**: No clicking, typing, or scrolling (use ui-deep-test for that)

## Efficiency Notes
- **Context-minimal**: Only the screenshot enters context (no DOM snapshots)
- **Single action**: One screenshot, one analysis, done
- **Fast model**: Designed to run on Haiku 4.5 (2x faster, 3x cheaper)
- **No file reads**: Doesn't read codebase files to save tokens

## Example Workflow

**User**: "Quick check on the login form at localhost:3000/login"

**Skill Actions**:
```bash
# Use Playwright MCP to take screenshot
1. Navigate to http://localhost:3000/login
2. Wait for page load (2 seconds max)
3. Take screenshot
4. Analyze: form visible? fields present? button styled?
5. Report findings in 2-3 sentences
```

**Output Format**:
```
✓ Login form renders correctly
✓ Email/password fields visible with proper spacing
✓ Submit button styled with brand colors
! Minor: Password field placeholder text slightly truncated on mobile viewport
```

## Anti-Patterns (DON'T)
- ❌ Don't read component source code (use ui-deep-test if code analysis needed)
- ❌ Don't test interactions (clicking, typing) - that's ui-deep-test
- ❌ Don't take multiple screenshots - single view only
- ❌ Don't suggest code fixes - just report what you see

## Success Criteria
- ✅ Under 10 seconds total execution time
- ✅ Under 1000 tokens of context usage
- ✅ Clear pass/fail assessment
- ✅ Specific visual details (colors, spacing, presence)
