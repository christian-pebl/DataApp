---
name: ui-iteration
description: Iterative UI refinement loop - screenshot, analyze, suggest changes, verify. Use when user wants to polish a specific component through multiple rounds of feedback. Requires Sonnet for iterative reasoning and code generation.
allowed-tools: Bash, Read, Edit, Write
---

# UI Iteration Skill

## Purpose
**Rapid iterative improvement** of a single UI component through multiple screenshot → fix → verify cycles. Requires Sonnet 4.5 for code generation and visual reasoning.

## When Claude Uses This
- User says "iterate on", "polish", "refine", or "make this look better"
- Working on a specific component that needs multiple adjustments
- Matching a design mockup through iteration
- Fine-tuning spacing, colors, typography
- User provides a target screenshot/mockup to match

## What This Skill Does

1. **Baseline Screenshot**: Capture current state of component
2. **Visual Analysis**: Compare to target (if provided) or identify improvements
3. **Code Changes**: Make targeted CSS/component adjustments
4. **Verify**: Take new screenshot and compare
5. **Repeat**: Up to 3 iterations or until user satisfied

## Tool Usage
- **Playwright MCP**: Screenshots for before/after comparison
- **Read**: Read component file once at start
- **Edit**: Make iterative improvements to styles/markup
- **Write**: Update styles if needed
- **Bash**: Trigger any necessary rebuilds

## Iteration Strategy

**Iteration Budget**: Max 3 cycles to avoid context explosion

**Per-Iteration Pattern**:
```bash
Cycle 1: Screenshot → Identify 3 biggest issues → Fix → Verify (~ 1500 tokens)
Cycle 2: Screenshot → Identify 2 remaining issues → Fix → Verify (~ 1200 tokens)
Cycle 3: Screenshot → Final polish → Verify → Done (~ 1000 tokens)

Total: ~3700 tokens (within budget)
```

## Example Workflow

**User**: "Iterate on the UserProfile card at localhost:3000/profile to match this design" [provides mockup]

**Skill Actions**:

### Cycle 1: Major Structure
```bash
1. Screenshot current state
2. Compare to mockup
3. Identify: Avatar too small, name not bold, bio missing
4. Edit UserProfile.tsx:
   - Increase avatar size 64px → 96px
   - Add font-weight-bold to name
   - Add bio field
5. Wait for hot reload
6. Screenshot new state
7. Assessment: Structure matches, but spacing off
```

### Cycle 2: Spacing & Layout
```bash
1. Screenshot current state (reuse browser, no reload)
2. Identify: Card padding tight, items not vertically centered
3. Edit styles:
   - Increase padding 16px → 24px
   - Add flexbox vertical centering
4. Screenshot new state
5. Assessment: Much better, but colors not matching
```

### Cycle 3: Visual Polish
```bash
1. Screenshot current state
2. Identify: Border color, background shade, shadow
3. Edit styles:
   - border-color: #e0e0e0 → #d1d1d1
   - background: white → #fafafa
   - Add subtle shadow
4. Screenshot new state
5. Final assessment: ✅ Matches mockup
```

**Output Format**:
```markdown
## UI Iteration Complete: UserProfile Card

### Changes Made (3 cycles)

**Cycle 1 - Structure** ✅
- Avatar: 64px → 96px
- Name: Added font-weight-bold
- Bio: Added missing field

**Cycle 2 - Layout** ✅
- Padding: 16px → 24px
- Centering: Added flexbox vertical alignment

**Cycle 3 - Visual** ✅
- Border: Adjusted color for better contrast
- Background: Subtle off-white (#fafafa)
- Shadow: Added 2px subtle elevation

### Final Result
[Shows final screenshot]
Component now matches design mockup. All spacing, colors, and typography aligned.

### Files Modified
- src/components/profile/UserProfile.tsx (15 lines changed)
- src/components/profile/styles.module.css (8 lines changed)
```

## Context Optimization

**Challenge**: Screenshots are expensive (~1000 tokens each)

**Optimizations**:
1. **Reuse browser session**: Don't close between cycles (saves navigation time)
2. **Smart screenshot timing**: Wait for hot reload, then screenshot immediately
3. **Incremental edits**: Small targeted changes per cycle, not complete rewrites
4. **Cache component code**: Read once, keep in memory across cycles
5. **Stop early**: If target met in 1-2 cycles, don't use all 3

**Token Budget Breakdown**:
- Component code read: ~500 tokens (once)
- Screenshot (×3-6): ~4000 tokens
- Analysis/suggestions (×3): ~1000 tokens
- Code edits (×3): ~500 tokens
- **Total**: ~6000 tokens (high but justified for iterative work)

## Anti-Patterns (DON'T)
- ❌ Don't iterate more than 3 times (diminishing returns + context bloat)
- ❌ Don't work on multiple components (focus on ONE)
- ❌ Don't do major refactors mid-iteration (small edits only)
- ❌ Don't read unrelated files (stay focused on target component)

## Success Criteria
- ✅ Component visibly improved after iterations
- ✅ Matches target mockup (if provided) or best practices
- ✅ Under 7,000 tokens total context usage
- ✅ Under 90 seconds total execution time
- ✅ Clear before/after comparison

## When NOT to Use This Skill
- ❌ User wants quick check (use ui-quick-check)
- ❌ Testing functionality, not visuals (use ui-deep-test)
- ❌ Major component rewrite needed (use main session)
- ❌ Working on multiple components (do them separately)

## Complementary Skills
- Start with **ui-quick-check** to see if iteration needed
- If console errors found, use **console-monitor** first
- After iteration, use **ui-deep-test** to verify nothing broke
