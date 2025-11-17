---
name: accessibility-check
description: Check accessibility tree structure and ARIA compliance. Use when user asks about accessibility, screen reader support, ARIA labels, or semantic HTML. Ultra-lightweight, uses text-based accessibility snapshot instead of screenshots.
allowed-tools: Bash
---

# Accessibility Check Skill

## Purpose
**Fast accessibility auditing** using Playwright's accessibility tree snapshot. Optimized for Haiku 4.5 - text-based analysis, no screenshots.

## When Claude Uses This
- User asks "is this accessible?" or "check accessibility"
- Screen reader support verification
- ARIA label validation
- Semantic HTML structure review
- Keyboard navigation testing
- WCAG compliance checks

## What This Skill Does

1. **Accessibility Snapshot**: Get text-based accessibility tree (not visual)
2. **Structure Analysis**: Verify heading hierarchy, landmarks, labels
3. **ARIA Audit**: Check roles, labels, descriptions, states
4. **Keyboard Nav**: Test tab order and focus management
5. **Report**: Categorized accessibility issues with WCAG levels

## Tool Usage
- **Playwright MCP ONLY**: Use `browser_snapshot` for accessibility tree
- **No screenshots**: Text tree is 10x cheaper than images
- **No code reads**: Pure runtime DOM analysis
- **No visual testing**: Structure/semantics only

## Why This is Efficient

**Accessibility Tree vs Screenshot**:
- Screenshot: ~1000-1500 tokens
- Accessibility tree: ~100-300 tokens
- **Savings: 5-10x cheaper!**

**Accessibility Tree Contains**:
- All semantic roles (button, heading, navigation, etc.)
- ARIA labels and descriptions
- Text content
- DOM hierarchy
- Interactive states (disabled, checked, expanded)

**What It Doesn't Show**:
- Visual appearance (colors, spacing, fonts)
- CSS styling
- Images (except alt text)
- Exact layout

## Example Workflow

**User**: "Check accessibility of the login form at localhost:3000/login"

**Skill Actions**:
```bash
# Use Playwright MCP browser_snapshot
1. Navigate to http://localhost:3000/login
2. Get accessibility snapshot (text-based)
3. Analyze tree structure:
   - Form landmarks?
   - Input labels?
   - Button roles?
   - Error announcements?
4. Test keyboard navigation:
   - Tab order logical?
   - Focus visible?
   - Enter key submits?
5. Report findings with WCAG levels
```

**Example Accessibility Tree**:
```
main
  form[name="login-form"]
    heading[level=2] "Sign In"
    textbox[name="Email"] (labeled, required)
    textbox[name="Password", type="password"] (labeled, required)
    link "Forgot password?"
    button "Sign In" (enabled)
  text "Don't have an account?"
  link "Sign up"
```

**Output Format**:
```markdown
## Accessibility Report: Login Form

### Summary
- ✅ 8 checks passed
- ⚠️ 3 warnings (WCAG AA)
- 🔴 1 error (WCAG A)

### Critical Issues (WCAG Level A)

#### 1. Password field missing aria-describedby
**Severity**: Error (WCAG 3.3.2)
**Element**: `textbox[name="Password"]`
**Issue**: No description of password requirements
**Impact**: Screen reader users don't know requirements
**Fix**: Add aria-describedby pointing to password hint element

### Warnings (WCAG Level AA)

#### 1. Heading hierarchy skipped level
**Severity**: Warning (WCAG 1.3.1)
**Element**: `heading[level=2]` at top of form
**Issue**: Page has no h1, starts with h2
**Impact**: Confusing page structure for screen readers
**Fix**: Change to h1 or add page h1 above form

#### 2. Link purpose unclear from text alone
**Element**: link "Sign up"
**Issue**: "Sign up" alone doesn't convey destination
**Impact**: Minor - context makes it clear
**Suggestion**: Consider "Sign up for an account"

### Keyboard Navigation
- ✅ Tab order: Email → Password → Forgot link → Sign in button → Sign up link
- ✅ Enter key submits form
- ✅ Focus indicators visible
- ⚠️ No "Skip to main content" link

### Semantic Structure
- ✅ Form uses `<form>` element (not divs)
- ✅ Inputs properly labeled with `<label>` elements
- ✅ Button uses `<button>` element
- ✅ Heading structure present
- ⚠️ No landmark regions (consider `<main>` wrapper)

### ARIA Usage
- ✅ No unnecessary ARIA (good - HTML semantics used)
- 🔴 Missing aria-describedby for password requirements
- ⚠️ Consider aria-invalid for error states

### Screen Reader Announcement Flow
1. "Sign In, heading level 2"
2. "Email, edit text, required"
3. "Password, secure edit text, required"
4. "Forgot password?, link"
5. "Sign In, button"
6. "Don't have an account? Sign up, link"

**Assessment**: Mostly accessible, critical fix needed for password description
```

## Advanced: Interactive Testing

**User**: "Check accessibility when form has errors"

```bash
1. Navigate to login page
2. Get baseline accessibility tree
3. Click submit without filling fields
4. Get new accessibility tree
5. Check for:
   - aria-invalid added?
   - Error messages announced?
   - Focus moved to first error?
6. Report dynamic accessibility
```

## Context Budget
- **Target**: 300-600 tokens per run
- **Max**: 1,000 tokens (complex pages)
- **How**: Accessibility tree is compact text, not images

**Comparison**:
- UI Quick Check (screenshot): ~1500 tokens
- Accessibility Check (tree): ~400 tokens
- **Savings: 73% cheaper!**

## Anti-Patterns (DON'T)
- ❌ Don't check visual accessibility (color contrast, font size) - use ui-quick-check
- ❌ Don't read component source code - runtime analysis only
- ❌ Don't test multiple pages per run - one page/component at a time
- ❌ Don't suggest code fixes - just report issues

## Success Criteria
- ✅ Under 10 seconds execution time
- ✅ Under 600 tokens context usage
- ✅ All WCAG A/AA issues identified
- ✅ Clear WCAG references (level + criterion number)
- ✅ Actionable recommendations

## WCAG Quick Reference

**Level A (Must Have)**:
- 1.1.1: Text alternatives for images
- 2.1.1: Keyboard accessible
- 3.3.2: Labels or instructions
- 4.1.2: Name, role, value (ARIA)

**Level AA (Should Have)**:
- 1.3.1: Heading hierarchy
- 1.4.3: Color contrast 4.5:1
- 2.4.6: Clear headings and labels
- 3.3.3: Error suggestions

## Complementary Skills
- **Visual accessibility?** → Use `ui-quick-check` for color contrast
- **Found ARIA issues?** → Use main session to fix code
- **Need full audit?** → Use `ui-deep-test` for comprehensive testing
- **Console errors?** → Use `console-monitor` to catch a11y warnings
