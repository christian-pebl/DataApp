# Accessibility Check - Extended Reference

## See Also
- [Playwright MCP Reference](../playwright-mcp-reference.md) - Shared API documentation
- [Skills System Guide](../SKILLS_GUIDE.md) - Overall architecture

## This Skill's Specifics

### Why Accessibility Tree is Efficient

**Token Comparison**:
- Screenshot (PNG): ~1000-1500 tokens
- Accessibility Tree (Text): ~100-300 tokens
- **Savings: 5-10x cheaper!**

**What's in the Tree**:
```
form[name="contact"]
  heading[level=2] "Contact Us"
  textbox[name="Email", aria-label="Email Address"] (required)
  textbox[name="Message", aria-label="Your Message"] (required)
  button "Submit" (enabled)
```

### WCAG Quick Checklist

**Level A (Critical)**:
- [ ] All images have alt text
- [ ] Keyboard accessible (no mouse-only)
- [ ] Form inputs have labels
- [ ] ARIA roles/names present

**Level AA (Recommended)**:
- [ ] Heading hierarchy logical
- [ ] Color contrast 4.5:1+
- [ ] Clear labels and instructions
- [ ] Error messages descriptive

**Level AAA (Gold Standard)**:
- [ ] Color contrast 7:1+
- [ ] No timing requirements
- [ ] Advanced keyboard navigation

### Common ARIA Attributes to Check
- `aria-label`: Accessible name
- `aria-labelledby`: Reference to label element
- `aria-describedby`: Additional description
- `aria-invalid`: Error state
- `aria-required`: Required field
- `aria-hidden`: Hidden from screen readers
- `role`: Semantic role override

### Screen Reader Testing Simulation
Accessibility tree shows what screen readers announce:
```
"Contact Us, heading level 2"
"Email Address, edit text, required"
"Your Message, edit text, required"
"Submit, button"
```
