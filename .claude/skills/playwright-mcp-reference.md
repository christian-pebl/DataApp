# Playwright MCP Reference

> **Note**: This file is loaded only when skills need Playwright API details. Progressive disclosure to save context tokens.

## Available Playwright MCP Tools (25 total)

### Navigation
- `browser_navigate` - Navigate to URL
- `browser_navigate_back` - Go back in history
- `browser_navigate_forward` - Go forward in history

### Screenshots & Capture
- `browser_screenshot` - Capture visible viewport as PNG
- `browser_snapshot` - Get accessibility tree (text-based, ultra-lightweight)
- `browser_pdf_save` - Save page as PDF

### Interaction
- `browser_click` - Click element by selector
- `browser_type` - Type text into element
- `browser_drag` - Drag and drop elements
- `browser_file_upload` - Upload files to input

### Element Inspection
- `browser_get_element` - Get element properties
- `browser_get_elements` - Query multiple elements
- `browser_wait_for` - Wait for element/condition

### Console & Network
- `browser_console` - Access console messages
- `browser_network` - Monitor network requests

### Tab Management
- `browser_tab_list` - List open tabs
- `browser_tab_new` - Open new tab
- `browser_tab_close` - Close tab
- `browser_tab_switch` - Switch active tab

### Utilities
- `browser_handle_dialog` - Handle alerts/confirms
- `browser_execute` - Run JavaScript in page context
- `browser_evaluate` - Evaluate expression and return result

## Common Patterns

### Quick Screenshot
```
Use playwright mcp to:
1. Navigate to http://localhost:3000/page
2. Wait 2 seconds for page load
3. Take screenshot
```

### Accessibility Tree (Lightweight)
```
Use playwright mcp to:
1. Navigate to http://localhost:3000/page
2. Get accessibility snapshot (not screenshot)
3. Return tree structure
```

### Console Monitoring
```
Use playwright mcp to:
1. Navigate to http://localhost:3000
2. Monitor console events
3. Wait 5 seconds
4. Report errors and warnings
```

### Interactive Testing
```
Use playwright mcp to:
1. Navigate to http://localhost:3000/form
2. Type "test@example.com" into [name="email"]
3. Type "password123" into [name="password"]
4. Click button[type="submit"]
5. Wait for navigation
6. Take screenshot of result
```

## Selector Strategies

**Priority Order**:
1. Accessibility selectors: `button[name="submit"]`, `input[aria-label="Email"]`
2. Data attributes: `[data-testid="login-button"]`
3. Semantic HTML: `button`, `form`, `nav`
4. CSS classes: `.btn-primary` (least preferred)

**Why**: Accessibility selectors are more stable and match how users interact

## Performance Tips

### Token Optimization
- `browser_snapshot` (a11y tree): ~100-300 tokens
- `browser_screenshot`: ~1000-1500 tokens
- **Use snapshot when no visual analysis needed**

### Speed Optimization
- Reuse browser session across multiple actions
- Don't close browser between related checks
- Use `wait_for` strategically (don't over-wait)

### Context Window Savings
- One snapshot/screenshot per check (not multiple angles)
- Don't capture full page if component suffices
- Prefer accessibility tree for structure analysis

## Localhost Development

### Next.js Dev Server
```bash
# Terminal 1
npm run dev
# Server at http://localhost:3000

# Terminal 2
claude
# Use playwright mcp to navigate to localhost:3000
```

### Hot Reload Timing
After code changes:
1. Wait 1-2 seconds for hot reload
2. Playwright will see updated page automatically
3. No need to manually refresh

## Error Handling

### Common Issues

**"Element not found"**
- Wait longer for page load
- Check selector syntax
- Use browser_wait_for before interaction

**"Navigation timeout"**
- Dev server might be down
- Port might be different (check :3000 vs :3001)
- Increase timeout parameter

**"Screenshot too large"**
- Specify viewport size
- Crop to relevant area
- Use snapshot instead if only structure needed

## WCAG Compliance Checks

### Using Accessibility Snapshot
```
browser_snapshot returns tree like:
main
  heading[level=1] "Page Title"
  form[name="contact"]
    textbox[name="Email"] (labeled, required)
    button "Submit"
```

### Check For
- Proper heading hierarchy (h1 → h2 → h3)
- All inputs have labels
- Buttons have accessible names
- Interactive elements have roles
- Focus order is logical

## Model Selection Guide

### Use Haiku 4.5 For (Fast & Cheap)
- ✅ Single screenshots with basic analysis
- ✅ Console monitoring (text-based)
- ✅ Accessibility tree analysis (text-based)
- ✅ Simple pass/fail checks

### Use Sonnet 4.5 For (Comprehensive)
- ✅ Multi-step interaction flows
- ✅ Iterative visual refinement
- ✅ Complex bug investigation
- ✅ Code + browser analysis combined
- ✅ Detailed reporting with suggestions

**Cost Difference**: Haiku is 3x cheaper, 2x faster
**When in doubt**: Start with Haiku, escalate to Sonnet if needed

---

## 🎯 Effective Debugging Workflow with Playwright MCP

> **Based on real-world debugging experience** - This workflow saved significant time when debugging a rarefaction chart height issue.

### **Golden Rule: Screenshot First, Always**

Before attempting ANY interactions, take a screenshot to understand:
- Current page layout
- Visual state of the UI
- Location of interactive elements
- Any error messages or unexpected rendering

```typescript
// ✅ ALWAYS START WITH THIS
1. browser_navigate(url)
2. browser_wait_for(time: 2-3)  // Let page settle
3. browser_screenshot()         // See what you're working with
```

---

### **5-Step Debugging Protocol**

When investigating bugs or testing features:

```
Step 1: 📸 SCREENSHOT → Understand visual state
Step 2: 🔍 CONSOLE → Check for errors/warnings (browser_console_messages)
Step 3: 🔬 INSPECT → DOM dimensions, styles, element properties
Step 4: 📂 CODE SEARCH → Find relevant components with targeted grep
Step 5: ✅ VERIFY → Fix, screenshot again, compare before/after
```

**Example from real debugging session:**
```typescript
// Problem: Rarefaction chart appeared as flat line
// Root cause found in Step 3:

browser_evaluate(`
  const svg = document.querySelector('.recharts-wrapper svg');
  return {
    svgPresent: !!svg,
    svgWidth: svg?.getAttribute('width'),
    svgHeight: svg?.getAttribute('height'), // ← Found 48px! Should be 600px
    yAxisValues: Array.from(document.querySelectorAll('.recharts-yAxis text'))
      .map(t => t.textContent)
  }
`)
```

This **immediately** revealed the 48px height compression issue.

---

### **Recognizing Common UI Patterns**

#### **Hamburger Menus (☰ Three Lines)**

**IMPORTANT**: When you see three horizontal lines (☰), this is a **hamburger menu button**. Common locations:
- Top-left corner
- Top-right corner (mobile)
- Navigation bars

**How to click it when standard methods fail:**

```typescript
// ❌ Often fails due to viewport/z-index issues
browser_click(element: "hamburger menu", ref: "e123")

// ✅ Use JavaScript evaluation instead
browser_evaluate(`
  // Find buttons on the left side
  const buttons = Array.from(document.querySelectorAll('button'));
  const leftButton = buttons.find(btn => {
    const rect = btn.getBoundingClientRect();
    return rect.left < 100 && rect.top < 200; // Top-left corner
  });

  if (leftButton) {
    leftButton.click();
    return 'Clicked hamburger menu';
  }
  return 'Not found';
`)
```

#### **Common Hidden UI Elements**

These often require clicking hamburger/dropdown menus first:
- **Project Data** - Usually in sidebar menu
- **Settings** - Gear icon or menu item
- **User Profile** - Avatar/initials in corner
- **Filters** - Funnel icon or "Filter" button
- **Sort Options** - Up/down arrows or "Sort" button

**Strategy**: If you can't find something in accessibility snapshot:
1. Look for hamburger menu (☰)
2. Look for "More" or "⋯" (three dots)
3. Check if element is in a collapsed panel/accordion

---

### **DOM Inspection Best Practices**

#### **When Visual Bug Occurs, Check Dimensions Immediately**

```typescript
// ✅ First thing to do for layout/rendering bugs
browser_evaluate(`
  const problemElement = document.querySelector('.chart-container');
  const rect = problemElement?.getBoundingClientRect();

  return {
    exists: !!problemElement,
    width: rect?.width,
    height: rect?.height,        // ← Often the smoking gun!
    computedStyle: {
      display: getComputedStyle(problemElement).display,
      position: getComputedStyle(problemElement).position,
      overflow: getComputedStyle(problemElement).overflow
    },
    parent: {
      width: problemElement.parentElement?.getBoundingClientRect().width,
      height: problemElement.parentElement?.getBoundingClientRect().height
    }
  }
`)
```

**Pattern Recognition:**
- `height: 48` when expecting 600 → **Container compression**
- `width: 0` → **Hidden parent or `display: none`**
- `height: auto` with no content → **Empty/loading state**

---

### **Efficient Code Navigation**

#### **Use Targeted Grep Before Reading Full Files**

```bash
# ❌ SLOW: Reading entire 3000-line component
Read(file_path: "src/components/BigComponent.tsx")

# ✅ FAST: Find specific section first
Grep(
  pattern: "dynamicChartHeight|containerHeight",
  path: "src/components/BigComponent.tsx",
  output_mode: "content",
  -n: true,           # Show line numbers
  -B: 5,              # 5 lines before
  -A: 5               # 5 lines after
)
```

#### **Follow the Data Flow**

When debugging state/props issues:
1. **Grep for variable name** across components
2. **Check where it's defined** (useState, props, memo)
3. **Find where it's passed** to child components
4. **Inspect calculation** logic

```bash
# Example: Tracking down "containerHeight" prop
Grep(pattern: "containerHeight.*=", type: "tsx", output_mode: "files_with_matches")
# Then narrow down:
Grep(pattern: "containerHeight.*800|containerHeight.*useMemo", ...)
```

---

### **Interactive Element Navigation**

#### **When Standard Click Fails**

Try in this order:

```typescript
// 1️⃣ Try standard Playwright click
browser_click(element: "Submit button", ref: "e456")

// 2️⃣ If viewport/overlap issues, scroll into view first
browser_evaluate(`
  const el = document.querySelector('button[type="submit"]');
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => el?.click(), 300);
  return 'Clicked after scroll';
`)

// 3️⃣ If still failing, use coordinate-based click
browser_evaluate(`
  const el = document.querySelector('button[type="submit"]');
  const rect = el?.getBoundingClientRect();
  const event = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  });
  el?.dispatchEvent(event);
  return 'Dispatched click event';
`)

// 4️⃣ Last resort: Find by position
browser_evaluate(`
  const buttons = Array.from(document.querySelectorAll('button'));
  const targetButton = buttons.find(btn => btn.textContent.includes('Submit'));
  targetButton?.click();
  return targetButton ? 'Clicked' : 'Not found';
`)
```

---

### **Screenshot Comparison Strategy**

When making fixes, always capture before/after:

```typescript
// Before fix
browser_screenshot(filename: "bug-before.png")

// Make code changes...

// After fix (wait for hot reload)
browser_wait_for(time: 3)
browser_screenshot(filename: "bug-after.png")
```

**Visual Diff Checklist:**
- ✅ Layout renders correctly?
- ✅ No console errors introduced?
- ✅ Animation/transition smooth?
- ✅ Text readable and aligned?
- ✅ Colors/contrast correct?

---

### **Console Log Mining**

Console logs often contain **critical debugging data**:

```typescript
browser_console_messages(onlyErrors: false)
```

**Look for:**
- `[COMPONENT-NAME]` debug prefixes
- Data dumps: `console.log('[RAREFACTION] Sample data:', data)`
- Error patterns: `undefined`, `null`, `NaN`
- Timing info: `⚡ Operation took 123ms`

**Real Example:**
```
[LOG] [RAREFACTION-CHART] Scatter data: [{"x": 1, "y": 13}, {"x": 2, "y": 15}, ...]
[LOG] [RAREFACTION-CHART] First point: {x: 1, y: 13}
[LOG] [RAREFACTION-CHART] Last point: {x: 6, y: 53}
```
↑ This confirmed data was correct, issue was rendering height!

---

### **Performance Debugging Patterns**

#### **Sluggish Interactions**

```typescript
// Check for:
// 1. Re-render loops
browser_evaluate(`
  let renderCount = 0;
  const observer = new MutationObserver(() => renderCount++);
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    observer.disconnect();
    return { renderCount, warning: renderCount > 100 ? 'Excessive renders!' : 'OK' };
  }, 2000);
`)

// 2. Heavy computations blocking UI
browser_console_messages() // Look for "Long Task" warnings

// 3. Network waterfalls
browser_network_requests() // Check for slow/failed requests
```

---

### **Accessibility Tree as Navigation Map**

The accessibility snapshot is your **UI map**. Use it to:

```yaml
# Example snapshot showing structure
dialog "Project Data Files"
  - heading "Project Data Files"
  - table
    - row "File Name | Start Date | End Date"
    - row "NORF_EDNAS_ALL_2507_Hapl.csv | - | -"
      - button "NORF_EDNAS_ALL_2507_Hapl.csv" [ref=e618]
```

**Navigation Strategy:**
1. **Snapshot first** → See available elements
2. **Identify ref codes** → `[ref=e618]`
3. **Click using ref** → `browser_click(ref: "e618")`
4. **New snapshot** → Verify navigation succeeded

---

### **Common Pitfalls & Solutions**

| Pitfall | ❌ Wrong Approach | ✅ Right Approach |
|---------|------------------|-------------------|
| **Can't find menu item** | Keep clicking random buttons | Screenshot → Find hamburger menu (☰) → Click → Screenshot |
| **Element not clickable** | Retry same method 5 times | Try evaluate() with JavaScript click |
| **Chart looks broken** | Read entire component code | Inspect dimensions first: `getBoundingClientRect()` |
| **Slow debugging** | Read files sequentially | Grep with context, read targeted sections |
| **Lost in codebase** | Random file searching | Follow props/state flow with grep |

---

### **Debugging Checklist (Print & Keep)**

Before starting any Playwright MCP debugging session:

- [ ] Take initial screenshot
- [ ] Check console for errors
- [ ] Inspect problem element dimensions
- [ ] Look for hamburger menus if navigation unclear
- [ ] Use `browser_evaluate` for complex interactions
- [ ] Grep before reading full files
- [ ] Compare before/after screenshots
- [ ] Verify fix with console logs
- [ ] Check for regressions in related features

---

### **Real-World Success Story**

**Problem**: Rarefaction chart displayed as flat line instead of ascending curve.

**Debugging Flow:**
1. 📸 Screenshot → Saw flat line
2. 🔍 Console → No errors, calculations working
3. 🔬 Inspect → **`svgHeight: "48px"`** ← **Found it!**
4. 📂 Grep → `dynamicChartHeight` calculation
5. ✅ Fix → Added haplotype file special case (800px)

**Time saved**: ~30 minutes by inspecting dimensions early instead of reading entire component.

**Key Insight**: For visual/layout bugs, **inspect rendered dimensions before reading code**.
