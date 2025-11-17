---
name: ui-deep-test
description: Comprehensive UI testing with interactions, multiple screenshots, and code analysis. Use for thorough feature testing, finding subtle bugs, interaction flows, or when user needs detailed analysis. Requires Sonnet 4.5 for complex reasoning.
allowed-tools: Bash, Read, Grep, Glob
---

# UI Deep Test Skill

## Purpose
Perform **comprehensive, multi-step UI testing** with interactions, code analysis, and detailed bug reporting. Uses full Sonnet 4.5 capabilities.

## When Claude Uses This
- User asks to "thoroughly test", "find all bugs", or "test the entire flow"
- Complex interaction sequences (multi-step forms, checkout flows, wizards)
- User reports subtle bugs that need investigation
- Integration testing (UI + API behavior)
- When quick-check finds issues needing deeper analysis

## What This Skill Does

1. **Read Component Code**: Understand implementation before testing
2. **Multi-Step Interactions**: Click buttons, fill forms, navigate flows
3. **Multiple Screenshots**: Before/after states, different viewports
4. **Console Monitoring**: Check for JavaScript errors during interactions
5. **Accessibility Tree**: Verify semantic structure
6. **Detailed Report**: Categorized bugs with severity and reproduction steps

## Tool Usage
- **Playwright MCP**: Full browser automation capabilities
- **Read**: Examine component source code for context
- **Grep**: Find related files (tests, types, utils)
- **Glob**: Locate component files
- **Bash**: Run additional checks if needed

## Efficiency Strategies
Despite being comprehensive, optimize for:
- **Progressive screenshots**: Only capture when state changes
- **Targeted file reads**: Read only relevant component files, not entire codebase
- **Concurrent checks**: Test multiple things per screenshot (layout + console + accessibility)
- **Early exit**: Stop testing if critical blocker found

## Example Workflow

**User**: "Test the entire checkout flow on localhost:3000/checkout"

**Skill Actions**:
```bash
# 1. CODE ANALYSIS (2-3 files max)
- Grep for "checkout" components
- Read CheckoutForm.tsx and payment components
- Understand expected behavior

# 2. BROWSER TESTING (5-7 screenshots max)
- Navigate to /checkout
- Screenshot: Initial state
- Fill shipping info → Screenshot
- Click "Next" → Check console → Screenshot
- Fill payment info → Screenshot
- Submit → Check network requests → Screenshot
- Verify confirmation page → Screenshot

# 3. CROSS-CUTTING CHECKS (per screenshot)
- Console errors?
- Layout breaks?
- Missing ARIA labels?
- Slow network requests?

# 4. DETAILED REPORT
- Categorize: Critical / High / Medium / Low
- Reproduction steps for each bug
- Suggested fixes with file locations
```

## Output Format

```markdown
## Deep Test Results: Checkout Flow

### Summary
- 🔴 2 Critical Issues
- 🟡 3 Medium Issues
- 🟢 5 Tests Passed

### Critical Issues

#### 1. Payment submission fails with validation error
**Severity**: Critical (blocks checkout)
**Location**: `src/components/checkout/PaymentForm.tsx:156`
**Reproduction**:
1. Fill valid credit card (4242 4242 4242 4242)
2. Click "Complete Order"
3. Error: "Invalid card number" despite valid input

**Root Cause**: Luhn validation function expects no spaces, but input mask adds spaces
**Suggested Fix**:
```typescript
// Line 156: Strip spaces before validation
const cleanCard = cardNumber.replace(/\s/g, '');
if (!validateLuhn(cleanCard)) { ... }
```

### Medium Issues
...

### Performance Notes
- Initial page load: 1.2s (acceptable)
- Payment API call: 3.5s (consider loading state)

### Accessibility
- ✓ All form inputs have labels
- ⚠️ Error messages not announced to screen readers
- ⚠️ Submit button missing aria-busy state
```

## Context Optimization

**Budget Targets**:
- Max 5,000 tokens per test run
- Max 7 screenshots
- Read max 3 source files

**How to Stay Under Budget**:
1. **Smart file reads**: Use Grep to find exact files, don't read entire directories
2. **Screenshot strategy**: Only capture state changes, not every action
3. **Consolidated checks**: Test 3-4 things per screenshot (console + UI + a11y)
4. **Reference external docs**: Put Playwright API docs in reference.md (separate file, loaded only when needed)

## Anti-Patterns (DON'T)
- ❌ Don't test entire application (test specific flows)
- ❌ Don't read every file in components directory
- ❌ Don't take 20+ screenshots (be selective)
- ❌ Don't re-test what ui-quick-check already verified

## Success Criteria
- ✅ Under 60 seconds execution time
- ✅ Under 5,000 tokens context usage
- ✅ Found all critical bugs in tested flow
- ✅ Reproduction steps for each bug
- ✅ Specific file/line references for fixes
