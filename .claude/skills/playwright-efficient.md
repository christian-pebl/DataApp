# Playwright Efficient Testing Skill

## Purpose
Use Playwright MCP tools efficiently to minimize context usage while maximizing testing effectiveness. Avoid large snapshot responses that consume 10k+ tokens.

## Core Principle
**Trust code analysis and console logs first. Use visual verification only when absolutely necessary.**

---

## ⚡ Efficient Playwright Patterns

### **Pattern 1: Console-First Verification**
**Use `browser_console_messages` instead of snapshots**

```typescript
// ❌ INEFFICIENT: Full snapshot (11k tokens)
await page.goto('http://localhost:9002/map-drawing');
// Returns massive YAML tree

// ✅ EFFICIENT: Console logs only (200-500 tokens)
await page.goto('http://localhost:9002/map-drawing');
await page.waitForTimeout(2000);
const messages = await browser_console_messages();
// Check for errors or success messages
```

**When to use**:
- Checking if data loaded successfully
- Verifying no JavaScript errors
- Confirming API calls completed

---

### **Pattern 2: Targeted Element Evaluation**
**Use `browser_evaluate` for specific checks**

```typescript
// ❌ INEFFICIENT: Full snapshot to check button
await browser_snapshot(); // 11k tokens

// ✅ EFFICIENT: Direct DOM query (50 tokens)
const buttonExists = await browser_evaluate({
  function: `() => {
    const button = document.querySelector('[data-testid="save-button"]');
    return {
      exists: !!button,
      disabled: button?.disabled,
      text: button?.textContent
    };
  }`
});
```

**When to use**:
- Checking element existence
- Verifying button states
- Reading specific text content
- Checking CSS classes or attributes

---

### **Pattern 3: Screenshot for Visual Verification Only**
**Use screenshots sparingly, only for actual visual bugs**

```typescript
// ❌ INEFFICIENT: Snapshot + screenshot for every check
await browser_snapshot();
await browser_take_screenshot();

// ✅ EFFICIENT: Screenshot only for visual regression
await browser_take_screenshot({
  element: "Chart container",
  ref: "e123", // Target specific element
  filename: "rarefaction-chart.png"
});
```

**When to use**:
- Visual regression testing
- Color/styling verification
- Layout issues
- User-reported visual bugs

---

### **Pattern 4: Network Request Monitoring**
**Use `browser_network_requests` for API validation**

```typescript
// ❌ INEFFICIENT: Multiple snapshots to verify data load
await browser_snapshot();
await page.click('button');
await browser_snapshot();

// ✅ EFFICIENT: Check network requests
await page.click('button');
await page.waitForTimeout(1000);
const requests = await browser_network_requests();
const apiCall = requests.find(r => r.url.includes('/api/files'));
// Verify status, response time, etc.
```

**When to use**:
- Verifying API calls
- Checking request/response data
- Performance timing analysis

---

### **Pattern 5: Batch Operations**
**Perform multiple actions before checking results**

```typescript
// ❌ INEFFICIENT: Snapshot after each action
await page.click('button1');
await browser_snapshot(); // 11k
await page.click('button2');
await browser_snapshot(); // 11k

// ✅ EFFICIENT: Actions first, single verification
await page.click('button1');
await page.click('button2');
await page.waitForTimeout(500);
const result = await browser_evaluate({
  function: `() => ({
    button1Active: document.querySelector('.button1')?.classList.contains('active'),
    button2Active: document.querySelector('.button2')?.classList.contains('active')
  })`
});
```

---

## 🎯 Decision Tree: Which Tool to Use?

```
Need to verify...
├─ JavaScript errors? → browser_console_messages
├─ API call succeeded? → browser_network_requests
├─ Element exists/state? → browser_evaluate
├─ Visual appearance? → browser_take_screenshot (element-specific)
└─ Complex interaction flow? → browser_evaluate + console_messages
```

---

## 📊 Context Usage Comparison

| Approach | Tools Used | Token Cost | Use Case |
|----------|-----------|------------|----------|
| **Inefficient** | `browser_snapshot` after each action | ~11k per call | ❌ Avoid |
| **Semi-efficient** | `browser_take_screenshot` full page | ~2-4k per call | ⚠️ Sparingly |
| **Efficient** | `browser_evaluate` + `browser_console_messages` | ~200-500 per call | ✅ Preferred |
| **Most efficient** | Code analysis only | ~0 | ✅ Best |

---

## 🚀 Real-World Example: Testing File Upload

### ❌ Inefficient Approach (35k tokens)
```typescript
await page.goto('http://localhost:9002/map-drawing');
await browser_snapshot(); // 11k

await page.click('[data-testid="upload-button"]');
await browser_snapshot(); // 11k

await page.setInputFiles('input[type="file"]', 'test.csv');
await browser_snapshot(); // 11k

await page.click('[data-testid="submit"]');
await browser_snapshot(); // 11k
// Total: ~44k tokens + overhead
```

### ✅ Efficient Approach (1k tokens)
```typescript
await page.goto('http://localhost:9002/map-drawing');
await page.waitForLoadState('networkidle');

// Perform all actions
await page.click('[data-testid="upload-button"]');
await page.setInputFiles('input[type="file"]', 'test.csv');
await page.click('[data-testid="submit"]');

// Single verification
await page.waitForTimeout(1000);
const results = await browser_evaluate({
  function: `() => ({
    uploadComplete: !!document.querySelector('.upload-success'),
    errorMessage: document.querySelector('.error')?.textContent,
    fileCount: document.querySelectorAll('.file-list-item').length
  })`
});

const consoleErrors = await browser_console_messages({ onlyErrors: true });
// Total: ~1k tokens
```

**Savings: 97% reduction in context usage**

---

## 📋 Best Practices Checklist

Before using Playwright, ask:

1. ✅ Can I verify this by reading the code?
2. ✅ Can I check console logs instead of DOM?
3. ✅ Can I use `browser_evaluate` instead of `browser_snapshot`?
4. ✅ Do I need full page or just specific element?
5. ✅ Can I batch multiple actions before checking?
6. ✅ Is visual verification actually needed?

**If yes to any above: Use the more efficient approach**

---

## 🎓 Training Examples

### Example 1: Check if data loaded
```typescript
// ❌ Don't do this
await browser_snapshot(); // Check if data in DOM

// ✅ Do this
const messages = await browser_console_messages();
const dataLoaded = messages.some(m => m.text.includes('Data loaded'));
```

### Example 2: Verify button click worked
```typescript
// ❌ Don't do this
await page.click('button');
await browser_snapshot();

// ✅ Do this
await page.click('button');
const state = await browser_evaluate({
  function: `() => document.querySelector('button').getAttribute('aria-pressed')`
});
```

### Example 3: Check chart rendered
```typescript
// ❌ Don't do this
await browser_snapshot(); // Full page
await browser_take_screenshot(); // Full page

// ✅ Do this
const chartExists = await browser_evaluate({
  function: `() => {
    const svg = document.querySelector('svg');
    const lines = svg?.querySelectorAll('path');
    return {
      hasSvg: !!svg,
      lineCount: lines?.length || 0,
      dimensions: {
        width: svg?.clientWidth,
        height: svg?.clientHeight
      }
    };
  }`
});

// Only screenshot if verification fails
if (!chartExists.hasSvg) {
  await browser_take_screenshot({ filename: 'chart-missing.png' });
}
```

---

## 🔧 Implementation Guidelines

### When Starting a Playwright Session

1. **Navigate once**
```typescript
await page.goto(url);
await page.waitForLoadState('networkidle'); // Ensure page loaded
```

2. **Check console for errors**
```typescript
const errors = await browser_console_messages({ onlyErrors: true });
if (errors.length > 0) {
  // Report errors and stop
}
```

3. **Use targeted verification**
```typescript
// Not snapshots
const verification = await browser_evaluate({ /* ... */ });
```

4. **Screenshot only if needed**
```typescript
// Only for visual issues or documentation
```

---

## 📐 Token Budget Guidelines

**For typical test session:**
- Navigation: 1 time (unavoidable ~500 tokens)
- Console checks: 2-3 times (~200 tokens each)
- Evaluations: 5-10 times (~100 tokens each)
- Screenshots: 0-2 times (~2k tokens each if needed)

**Total: ~2-3k tokens vs 30-50k with snapshots**

---

## 🎯 Success Metrics

Track your Playwright efficiency:

```
Efficiency Score = Verifications / Total Tokens Used

Target:
- Excellent: > 10 verifications per 1k tokens
- Good: 5-10 verifications per 1k tokens
- Poor: < 5 verifications per 1k tokens (too many snapshots!)
```

---

## 🔄 Quick Reference Commands

```typescript
// Check console
await browser_console_messages({ onlyErrors: true })

// Query DOM
await browser_evaluate({ function: `() => /* query */` })

// Check network
await browser_network_requests()

// Wait for changes
await page.waitForTimeout(500)

// Screenshot (sparingly!)
await browser_take_screenshot({ element: "desc", ref: "eXX" })
```

---

## ⚠️ Anti-Patterns to Avoid

1. ❌ Calling `browser_snapshot` after every interaction
2. ❌ Using snapshots to check if element exists
3. ❌ Taking full-page screenshots for small checks
4. ❌ Not batching related actions
5. ❌ Using Playwright when code analysis would suffice

---

## 💡 Remember

**The best Playwright test is the one you don't need to run.**

Prefer: Code Analysis → Console Logs → DOM Queries → Screenshots

This skill should reduce Playwright context usage by **80-95%** while maintaining test quality.
