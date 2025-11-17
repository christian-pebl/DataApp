# PEBL Data App Documentation

This directory contains comprehensive documentation for the PEBL Data App, including architecture, optimization records, AI-assisted development notes, and code reviews.

---

## 📁 Directory Structure

```
docs/
├── README.md                          # This file - documentation index
├── optimization/                      # App optimization documentation
│   ├── README.md                     # Optimization index & guide
│   └── APP_OPTIMIZATION_2025-10-15.md # Logger, testing, data explorer improvements
├── ai_assist/                         # AI-generated documentation
├── automation/                        # Automation scripts and workflows
├── index/                            # Code indices and mappings
└── review/                           # Code review documentation
```

---

## 🔍 Quick Links

### For Code Optimization
📖 **[Optimization Documentation](./optimization/README.md)**
- Past optimization sessions
- Incomplete optimization work
- Implementation guides
- Testing checklists

**Featured Topics:**
- [Logger System Implementation](./optimization/APP_OPTIMIZATION_2025-10-15.md#1-logger-system-implementation)
- [Testing Infrastructure Setup](./optimization/APP_OPTIMIZATION_2025-10-15.md#2-testing-infrastructure)
- [Type System Improvements](./optimization/APP_OPTIMIZATION_2025-10-15.md#4-type-system-consolidation)

### For Development Tasks
📋 **[Task List (CLAUDE.md)](../CLAUDE.md)**
- Current TODO items
- Implementation details
- Feature requests

### For Architecture Understanding
🗺️ **[Code Map (CODE_MAP.md)](../CODE_MAP.md)**
- Codebase structure
- Module dependencies
- Key files and their purposes

---

## 🎯 Use Cases

### "I want to optimize the codebase"
1. Go to **[docs/optimization/](./optimization/)** directory
2. Read the **[Optimization README](./optimization/README.md)**
3. Look for incomplete optimization work marked ⚠️
4. Start with high-priority, low-risk items
5. Follow the testing checklist

### "I want to implement a TODO item"
1. Check **[CLAUDE.md](../CLAUDE.md)** for current tasks
2. Review any related optimization docs
3. Create feature branch
4. Implement incrementally
5. Test thoroughly

### "I want to understand the codebase"
1. Read **[CODE_MAP.md](../CODE_MAP.md)** for overview
2. Check **[docs/index/](./index/)** for detailed mappings
3. Review component documentation in **[docs/ai_assist/](./ai_assist/)**

### "I want to review code changes"
1. Check **[docs/review/](./review/)** for past reviews
2. Look for related optimization docs
3. Use testing checklists from optimization docs

---

## 📊 Documentation Standards

### When Creating New Documentation

#### Optimization Documents
- Use naming: `APP_OPTIMIZATION_YYYY-MM-DD.md`
- Include status, changes, issues, testing, recovery
- Update the optimization README index
- Mark priority and risk level

#### Feature Documentation
- Document as you build
- Include usage examples
- Note dependencies
- Add troubleshooting section

#### Code Review Documentation
- Reference commit hashes
- Include before/after examples
- Note testing performed
- Document decisions made

---

## 🔧 Maintenance

### Document Review Schedule
- **After each optimization session**: Update optimization docs
- **After major features**: Create feature documentation
- **Monthly**: Review and consolidate documentation
- **Before releases**: Audit all documentation for accuracy

### Who Maintains What
- **optimization/**: Updated after each optimization session
- **ai_assist/**: Auto-generated, reviewed periodically
- **review/**: Updated during code review process
- **index/**: Regenerated as needed

---

## 🚀 Getting Started

### For New Developers
1. Read this README
2. Review [CODE_MAP.md](../CODE_MAP.md)
3. Check [CLAUDE.md](../CLAUDE.md) for current tasks
4. Explore component documentation

### For Optimization Work
1. Start at [optimization/README.md](./optimization/README.md)
2. Review incomplete optimization work
3. Choose high-priority, low-risk items
4. Follow implementation guidelines

### For Bug Fixes
1. Search docs for related components
2. Check optimization docs for recent changes
3. Review testing checklists
4. Document fix in appropriate location

---

## 📞 Questions?

- **For optimization questions**: See [optimization/README.md](./optimization/README.md)
- **For task questions**: See [CLAUDE.md](../CLAUDE.md)
- **For architecture questions**: See [CODE_MAP.md](../CODE_MAP.md)

---

**Last Updated:** October 15, 2025
**Maintained By:** Development Team
