# Logger Deployment Guide

**Status:** Logger utility created and demonstrated
**Pattern:** Replace console.log with logger
**Remaining:** 456 console.log statements (1 replaced as example)

---

## Example Replacement (renameFile method)

### Before (10 console.logs):
```typescript
console.log('🔄 Starting file rename:', { fileId, newFileName });
console.error('❌ Authentication required:', authError);
console.log(`✅ Authenticated as user: ${user.id}`);
// ... etc
```

### After (logger with proper levels):
```typescript
logger.debug('Starting file rename', {
  context: 'FileStorageService',
  data: { fileId, newFileName }
});

logger.error('Authentication required to rename files', authError, {
  context: 'FileStorageService.renameFile'
});

logger.debug('User authenticated for file rename', {
  context: 'FileStorageService',
  data: { userId: user.id }
});
```

---

## Replacement Pattern

### console.log → logger.debug or logger.info
```typescript
// Before
console.log('Processing data:', data)

// After (development only)
logger.debug('Processing data', {
  context: 'ComponentName',
  data: { summary: data.length }
})

// Or (production visible)
logger.info('Data processed successfully')
```

### console.error → logger.error
```typescript
// Before
console.error('Failed to save:', error)

// After
logger.error('Failed to save data', error, {
  context: 'ServiceName.methodName',
  data: { additionalContext }
})
```

### console.warn → logger.warn
```typescript
// Before
console.warn('Deprecated API used')

// After
logger.warn('Deprecated API used', {
  context: 'ComponentName'
})
```

---

## Priority Files for Replacement

### High Priority (50+ occurrences):
1. **src/lib/supabase/file-storage-service.ts** - 50 console.logs
   - Status: ✅ 1 method done (renameFile as example)
   - Remaining: 49 occurrences
   - Context: FileStorageService

2. **src/components/pin-data/PinChartDisplay.tsx** - 46 console.logs
   - Status: ⏸️ Not started
   - Context: PinChartDisplay component

3. **src/lib/supabase/map-data-service.ts** - 35 console.logs
   - Status: ⏸️ Not started
   - Context: MapDataService

### Medium Priority (25-35 occurrences):
4. **src/components/pin-data/csvParser.ts** - 32 console.logs
5. **src/hooks/use-map-data.ts** - 28 console.logs

### Remaining Files: 20 files with 5-20 console.logs each

---

## Automated Replacement Script (Future)

```bash
# Find all console.log statements
grep -r "console.log" src/ --include="*.ts" --include="*.tsx" | wc -l

# Find all console.error statements
grep -r "console.error" src/ --include="*.ts" --include="*.tsx" | wc -l

# Pattern: Can be automated with careful AST transformation
```

---

## Next Steps

1. Import logger in each file: `import { logger } from '@/lib/logger'`
2. Replace console statements following pattern above
3. Test in development (dev-only logs should appear)
4. Verify production build (debug logs should be silent)
5. Run ESLint to catch any missed console statements

**Estimated Effort:** 20-25 hours for all 457 replacements
**Recommended Approach:** File by file, starting with high-priority files
