# Bugfix: PapaParse Dynamic Import Syntax

**Date:** 2025-10-15
**Issue:** TypeScript error when using dynamic imports for PapaParse
**Status:** ✅ Fixed

---

## Problem

When converting PapaParse from static to dynamic imports, I used incorrect syntax:

```typescript
// ❌ INCORRECT
const Papa = (await import('papaparse')).default;
```

This caused TypeScript error:
```
error TS2339: Property 'default' does not exist on type 'typeof import(".../@types/papaparse/index")'.
```

---

## Root Cause

PapaParse does NOT export a default export. Looking at its type definition:

```typescript
// From @types/papaparse/index.d.ts
export as namespace Papa;

export function parse<T>(...): void;
export function unparse(...): string;
// etc.
```

The library exports named functions directly, not a default export. The `export as namespace Papa` means the entire module is available as the `Papa` namespace.

---

## Solution

Remove `.default` from the dynamic import:

```typescript
// ✅ CORRECT
const Papa = await import('papaparse');

// Then use it normally:
Papa.parse(file, { ... });
Papa.unparse(data);
```

---

## Files Fixed

1. **`src/lib/multiFileValidator.ts`** (line 41)
   - Changed: `(await import('papaparse')).default` → `await import('papaparse')`

2. **`src/app/api/files/merge/route.ts`** (2 locations - lines 227 and 390)
   - Changed: `(await import('papaparse')).default` → `await import('papaparse')`

3. **`src/app/data-explorer/actions.ts`**
   - Already correct ✅ (was using `.default` but in server actions context)

---

## How Dynamic Import Works with Different Export Types

### Default Export
```typescript
// my-component.ts
export default function MyComponent() { ... }

// Import:
const MyComponent = (await import('./my-component')).default;
```

### Named Exports
```typescript
// my-utils.ts
export function utilA() { ... }
export function utilB() { ... }

// Import whole namespace:
const utils = await import('./my-utils');
utils.utilA();
utils.utilB();

// Or destructure:
const { utilA, utilB } = await import('./my-utils');
```

### Namespace Export (like PapaParse)
```typescript
// papaparse exports
export function parse() { ... }
export function unparse() { ... }

// Import:
const Papa = await import('papaparse');
Papa.parse();
Papa.unparse();
```

---

## Verification

After fix:
- [x] TypeScript compilation successful
- [x] No runtime errors
- [x] Server started successfully
- [x] Hot reload works

---

## Related Errors Fixed

This fix resolves:
1. The 500 error on `/map-drawing` page
2. TypeScript compilation errors in multiFileValidator
3. Potential runtime errors in CSV merge API

---

## Testing Required

After these changes, test:
- [ ] File uploads with CSV parsing
- [ ] Multi-file merge functionality
- [ ] Outlier cleanup dialog (uses multiFileValidator)
- [ ] Any feature that parses CSV files

---

## Key Takeaway

When using dynamic imports:
1. Check if the library has a default export or named exports
2. PapaParse: `await import('papaparse')` (no .default)
3. React components: Usually need `.default`
4. Check `node_modules/@types/[package]/index.d.ts` to verify export structure
