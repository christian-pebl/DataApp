# Quick Start Implementation Guide
## Priority Fixes for Production Readiness

**Target Audience:** Development Team
**Time Required:** 2 weeks (80 hours total)
**Goal:** Resolve all HIGH severity findings

---

## Week 1: Critical Security & Observability (40 hours)

### Day 1 (Monday) - Security Headers & Setup (8 hours)

#### Morning: Security Headers (4 hours)
**Owner:** Any developer
**Files to modify:** `next.config.ts`

**Step 1: Add headers configuration (30 minutes)**
```typescript
// next.config.ts - Add after line 281 (before export)
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()'
        },
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on'
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains'
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.basemaps.cartocdn.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-src 'none'",
          ].join('; ')
        }
      ]
    }
  ];
},
```

**Step 2: Test locally (15 minutes)**
```bash
npm run dev
# Open http://localhost:9002
# Open DevTools → Network → Select any request → Headers
# Verify all 7 security headers present
```

**Step 3: Deploy to preview environment (30 minutes)**
```bash
git add next.config.ts
git commit -m "Add security headers (FINDING #21)"
git push origin feature/security-headers
# Create PR, deploy to Vercel preview
```

**Step 4: Test deployed headers (15 minutes)**
```bash
# Test with SecurityHeaders.com
# https://securityheaders.com/?q=your-preview-url.vercel.app
# Target: A or A+ rating
```

**Step 5: Monitor for CSP violations (2 hours)**
- Check browser console for CSP errors
- Test all major features (map, file upload, charts)
- Adjust CSP if needed
- Document any required exceptions

**Step 6: Merge to main (30 minutes)**

**Checklist:**
- [ ] All 7 headers present
- [ ] SecurityHeaders.com score: A+
- [ ] No console CSP violations
- [ ] All features working
- [ ] PR approved and merged

---

#### Afternoon: Sentry Setup (4 hours)
**Owner:** Lead developer
**Goal:** Production error tracking

**Step 1: Create Sentry account (15 minutes)**
1. Go to https://sentry.io/signup/
2. Create free account (5,000 errors/month)
3. Create new project: "PEBL DataApp"
4. Select platform: Next.js

**Step 2: Install Sentry (15 minutes)**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Wizard will:
- Create `sentry.client.config.ts`
- Create `sentry.server.config.ts`
- Create `sentry.edge.config.ts`
- Update `next.config.ts`
- Add `.sentryclirc` (add to .gitignore!)

**Step 3: Configure Sentry (1 hour)**

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of requests

  // Session replay (optional, uses quota)
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of errors

  environment: process.env.NODE_ENV,

  // Filter out noise
  beforeSend(event, hint) {
    // Ignore expected errors
    if (event.message?.includes('Auth session missing')) {
      return null;
    }

    // Add user context
    if (event.user?.id) {
      event.user.email = 'redacted'; // GDPR compliance
    }

    return event;
  },

  // Integration settings
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: [
        "localhost",
        /^https:\/\/.*\.vercel\.app/,
        /^https:\/\/yourdomain\.com/
      ],
    }),
    new Sentry.Replay(),
  ],
});
```

**Step 4: Add environment variables (15 minutes)**
```bash
# .env.local
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=pebl-dataapp
SENTRY_AUTH_TOKEN=xxx

# Add to Vercel environment variables
vercel env add NEXT_PUBLIC_SENTRY_DSN
vercel env add SENTRY_AUTH_TOKEN
```

**Step 5: Test error tracking (1 hour)**

Create test page:
```typescript
// src/app/test-sentry/page.tsx (TEMPORARY)
'use client';
import * as Sentry from '@sentry/nextjs';

export default function TestSentry() {
  return (
    <div className="p-8">
      <h1>Sentry Test Page</h1>
      <button onClick={() => {
        throw new Error('Test error');
      }}>
        Throw Error
      </button>

      <button onClick={() => {
        Sentry.captureMessage('Test message', 'info');
      }}>
        Send Message
      </button>

      <button onClick={async () => {
        try {
          await fetch('/api/nonexistent');
        } catch (e) {
          Sentry.captureException(e);
        }
      }}>
        Test API Error
      </button>
    </div>
  );
}
```

Test:
1. Click each button
2. Check Sentry dashboard (https://sentry.io)
3. Verify errors appear within 30 seconds
4. Check stack traces are source-mapped
5. Delete test page after verification

**Step 6: Configure alerts (30 minutes)**
1. Sentry → Project Settings → Alerts
2. Create alert: "Error rate > 10/min"
3. Add notification channels (email, Slack)
4. Test alert triggering

**Checklist:**
- [ ] Sentry installed
- [ ] Error tracking working
- [ ] Source maps uploading
- [ ] Alerts configured
- [ ] Team members added

---

### Day 2 (Tuesday) - Build Configuration & Logger Migration Prep (8 hours)

#### Morning: Fix Build Configuration (4 hours)
**Owner:** Lead developer
**Goal:** Enable TypeScript & ESLint checks

**Step 1: Audit current errors (1 hour)**
```bash
# Check TypeScript errors
npm run typecheck > typescript-errors.txt

# Check ESLint errors
npm run lint > eslint-errors.txt

# Count errors
wc -l typescript-errors.txt
wc -l eslint-errors.txt
```

**Step 2: Categorize and prioritize (1 hour)**
Group errors by:
- Critical (services, data processing)
- High (components with business logic)
- Medium (UI components)
- Low (test files, deprecated code)

Create GitHub issues for each category.

**Step 3: Fix critical errors (2 hours)**
Focus on:
- `src/lib/supabase/` services
- `src/components/pin-data/csvParser.ts`
- `src/lib/` utilities

Common patterns:
```typescript
// Type 'any' errors
-const data: any = await fetchData();
+const data: DatabaseResult = await fetchData();

// Implicit any parameters
-function process(item) {
+function process(item: Item): Result {

// Null/undefined checks
-user.name.toUpperCase()
+user?.name?.toUpperCase() ?? 'Unknown'
```

**Step 4: Enable checks (if 80%+ fixed)**
```typescript
// next.config.ts
typescript: {
  ignoreBuildErrors: false, // ✅ ENABLED
},
eslint: {
  ignoreDuringBuilds: false, // ✅ ENABLED
},
```

**Or keep disabled but add to CI:**
```yaml
# .github/workflows/ci.yml
- name: Type check
  run: npm run typecheck
  continue-on-error: true # Warn but don't fail
```

**Checklist:**
- [ ] Error audit complete
- [ ] GitHub issues created
- [ ] Critical errors fixed
- [ ] Build configuration decided
- [ ] CI configured

---

#### Afternoon: Logger Migration - Top 5 Files (4 hours)
**Owner:** Senior developer
**Goal:** Migrate highest-impact files

**Files to migrate:**
1. `src/lib/supabase/file-storage-service.ts` (50+ logs)
2. `src/components/pin-data/PinChartDisplay.tsx` (46+ logs)
3. `src/lib/supabase/map-data-service.ts` (35+ logs)
4. `src/components/pin-data/csvParser.ts` (32+ logs)
5. `src/hooks/use-map-data.ts` (~20 logs)

**Migration process per file (45 min each):**

**Step 1: Add logger import**
```typescript
import { logger } from '@/lib/logger';
```

**Step 2: Replace console.logs**
```typescript
// Pattern 1: Info logs
-console.log('🔐 Checking authentication...');
+logger.info('Checking authentication', { context: 'file-storage-service' });

// Pattern 2: Error logs
-console.error('❌ Upload failed:', error);
+logger.error('Upload failed', error, {
+  context: 'file-storage-service',
+  data: { fileName, pinId }
+});

// Pattern 3: Debug logs
-console.log('📊 Processing data:', data);
+logger.debug('Processing data', {
+  context: 'file-storage-service',
+  data: { rowCount: data.length }
+});

// Pattern 4: Success logs
-console.log('✅ Upload successful:', fileName);
+logger.info('Upload successful', {
+  context: 'file-storage-service',
+  data: { fileName, fileSize }
+});
```

**Step 3: Update logger to send to Sentry**
```typescript
// src/lib/logger.ts
import * as Sentry from '@sentry/nextjs';

export class Logger {
  error(message: string, error?: Error, options?: LogOptions): void {
    const prefix = `[${options?.context || 'app'}]`;
    console.error(`${prefix} ${message}`, error, options?.data);

    // Send to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      if (error) {
        Sentry.captureException(error, {
          level: 'error',
          tags: { context: options?.context },
          extra: options?.data,
        });
      } else {
        Sentry.captureMessage(message, {
          level: 'error',
          tags: { context: options?.context },
          extra: options?.data,
        });
      }
    }
  }

  warn(message: string, options?: LogOptions): void {
    const prefix = `[${options?.context || 'app'}]`;
    console.warn(`${prefix} ${message}`, options?.data);

    if (process.env.NODE_ENV === 'production') {
      Sentry.captureMessage(message, {
        level: 'warning',
        tags: { context: options?.context },
        extra: options?.data,
      });
    }
  }

  info(message: string, options?: LogOptions): void {
    const prefix = `[${options?.context || 'app'}]`;
    console.log(`${prefix} ${message}`, options?.data);
    // Info logs not sent to Sentry (too noisy)
  }

  debug(message: string, options?: LogOptions): void {
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[${options?.context || 'app'}]`;
      console.log(`${prefix} ${message}`, options?.data);
    }
  }
}

export const logger = new Logger();
```

**Step 4: Test each file**
- Trigger relevant code paths
- Verify logs appear in console (dev)
- Verify errors reach Sentry (prod)

**Checklist:**
- [ ] file-storage-service.ts migrated
- [ ] PinChartDisplay.tsx migrated
- [ ] map-data-service.ts migrated
- [ ] csvParser.ts migrated
- [ ] use-map-data.ts migrated
- [ ] Logger enhanced with Sentry
- [ ] All tested

---

### Day 3 (Wednesday) - Password Policy & File Validation (8 hours)

#### Morning: Strengthen Password Policy (3 hours)
**Owner:** Any developer
**File:** `src/components/auth/UserMenu.tsx`

**Step 1: Add password strength validator (1 hour)**
```typescript
// src/lib/password-validator.ts (NEW FILE)
export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-5
  feedback: string[];
}

export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 12) {
    feedback.push('Password must be at least 12 characters');
  } else {
    score += 1;
    if (password.length >= 16) score += 1;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    feedback.push('Include at least one uppercase letter (A-Z)');
  } else {
    score += 1;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    feedback.push('Include at least one lowercase letter (a-z)');
  } else {
    score += 1;
  }

  // Number check
  if (!/\d/.test(password)) {
    feedback.push('Include at least one number (0-9)');
  } else {
    score += 1;
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Include at least one special character (!@#$%^&* etc.)');
  } else {
    score += 1;
  }

  // Common patterns check
  const commonPasswords = ['password', '12345678', 'qwerty', 'admin'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    feedback.push('Avoid common passwords and patterns');
    score = Math.max(0, score - 2);
  }

  return {
    isValid: score >= 4,
    score,
    feedback
  };
}
```

**Step 2: Add password strength meter UI (1 hour)**
```typescript
// src/components/auth/PasswordStrengthMeter.tsx (NEW FILE)
interface Props {
  password: string;
}

export function PasswordStrengthMeter({ password }: Props) {
  const strength = validatePassword(password);

  const getColor = (score: number) => {
    if (score < 2) return 'bg-red-500';
    if (score < 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getLabel = (score: number) => {
    if (score < 2) return 'Weak';
    if (score < 4) return 'Fair';
    if (score < 5) return 'Good';
    return 'Strong';
  };

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${
              i < strength.score ? getColor(strength.score) : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-gray-600">
        Strength: {getLabel(strength.score)}
      </p>
      {strength.feedback.length > 0 && (
        <ul className="text-xs text-gray-500 list-disc list-inside">
          {strength.feedback.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Step 3: Update UserMenu component (1 hour)**
```typescript
// src/components/auth/UserMenu.tsx
import { validatePassword } from '@/lib/password-validator';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

const handlePasswordChange = async () => {
  // Validate password
  const validation = validatePassword(newPassword);

  if (!validation.isValid) {
    setPasswordError(validation.feedback.join('. '));
    return;
  }

  // Verify current password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword
  });

  if (signInError) {
    setPasswordError('Current password is incorrect');
    return;
  }

  // Update password
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    setPasswordError(error.message);
  } else {
    toast({
      title: 'Password updated',
      description: 'Your password has been changed successfully'
    });
    setShowPasswordDialog(false);
  }
};

// In JSX:
<Input
  type="password"
  value={newPassword}
  onChange={(e) => setNewPassword(e.target.value)}
/>
<PasswordStrengthMeter password={newPassword} />
```

**Checklist:**
- [ ] Password validator created
- [ ] Strength meter component created
- [ ] UserMenu updated
- [ ] UI tested with various passwords
- [ ] Minimum 12 characters enforced

---

#### Afternoon: File Upload Validation (3 hours)
**Owner:** Any developer
**File:** `src/lib/supabase/file-storage-service.ts`

**Step 1: Add file validator (1 hour)**
```typescript
// src/lib/file-validator.ts (NEW FILE)
export interface FileValidation {
  isValid: boolean;
  errors: string[];
}

const ALLOWED_TYPES = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel', // Legacy CSV
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function validateFile(file: File): FileValidation {
  const errors: string[] = [];

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    // Also check extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      errors.push(
        `Invalid file type. Allowed: CSV, TXT. Got: ${file.type || ext}`
      );
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(
      `File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB. Got: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    );
  }

  // Check file name
  if (file.name.length > 255) {
    errors.push('File name too long (max 255 characters)');
  }

  // Check for suspicious extensions
  const suspiciousExts = ['.exe', '.sh', '.bat', '.cmd', '.com', '.scr'];
  if (suspiciousExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
    errors.push('Suspicious file extension detected');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

**Step 2: Update file upload service (1 hour)**
```typescript
// src/lib/supabase/file-storage-service.ts
import { validateFile } from '@/lib/file-validator';
import { logger } from '@/lib/logger';

async uploadFile(target: UploadTarget, file: File, projectId: string) {
  // Validate file
  const validation = validateFile(file);
  if (!validation.isValid) {
    logger.warn('File validation failed', {
      context: 'file-storage-service',
      data: { errors: validation.errors, fileName: file.name }
    });
    return {
      success: false,
      error: validation.errors.join('. ')
    };
  }

  // Existing upload logic...
  logger.info('File upload started', {
    context: 'file-storage-service',
    data: {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      targetId: target.id
    }
  });

  try {
    // ... upload code ...

    logger.info('File upload successful', {
      context: 'file-storage-service',
      data: { fileName: file.name, filePath }
    });

    return { success: true, data: metadata };
  } catch (error) {
    logger.error('File upload failed', error as Error, {
      context: 'file-storage-service',
      data: { fileName: file.name }
    });
    return { success: false, error: (error as Error).message };
  }
}
```

**Step 3: Add user feedback (30 minutes)**
```typescript
// src/components/pin-data/FileUploadDialog.tsx
const handleFileSelect = (file: File) => {
  const validation = validateFile(file);

  if (!validation.isValid) {
    toast({
      variant: 'destructive',
      title: 'Invalid File',
      description: (
        <ul className="list-disc list-inside">
          {validation.errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )
    });
    return;
  }

  // Continue with upload...
};
```

**Step 4: Add unit tests (30 minutes)**
```typescript
// src/lib/__tests__/file-validator.test.ts
import { validateFile } from '../file-validator';

describe('File Validator', () => {
  it('accepts valid CSV file', () => {
    const file = new File(['data'], 'test.csv', { type: 'text/csv' });
    const result = validateFile(file);
    expect(result.isValid).toBe(true);
  });

  it('rejects oversized file', () => {
    const largeData = new Array(60 * 1024 * 1024).fill('x').join('');
    const file = new File([largeData], 'large.csv', { type: 'text/csv' });
    const result = validateFile(file);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('too large');
  });

  it('rejects invalid file type', () => {
    const file = new File(['data'], 'test.exe', { type: 'application/x-msdownload' });
    const result = validateFile(file);
    expect(result.isValid).toBe(false);
  });
});
```

**Checklist:**
- [ ] File validator created
- [ ] Upload service updated
- [ ] User feedback added
- [ ] Unit tests written
- [ ] All tests passing

---

#### Extra: Add DOMPurify for sanitization (2 hours)
**Owner:** Any developer

**Step 1: Install DOMPurify**
```bash
npm install isomorphic-dompurify
npm install --save-dev @types/dompurify
```

**Step 2: Create sanitizer utility**
```typescript
// src/lib/sanitize.ts (NEW FILE)
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // Remove all HTML tags
    ALLOWED_ATTR: []
  });
}

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'title']
  });
}
```

**Step 3: Apply to user inputs**
```typescript
// Before saving to database
import { sanitizeText } from '@/lib/sanitize';

const pinData = {
  label: sanitizeText(label),
  notes: sanitizeText(notes),
};
```

**Checklist:**
- [ ] DOMPurify installed
- [ ] Sanitizer utility created
- [ ] Applied to all user text inputs
- [ ] Tested with malicious input

---

### Day 4 (Thursday) - Rate Limiting & Monitoring (8 hours)

#### Morning: Rate Limiting (4 hours)
**Owner:** Senior developer

**Step 1: Setup Upstash Redis (30 minutes)**
1. Go to https://upstash.com
2. Create free account
3. Create Redis database
4. Copy connection details

**Step 2: Install dependencies**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Step 3: Configure environment**
```bash
# .env.local
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

**Step 4: Create rate limiter (1 hour)**
```typescript
// src/lib/rate-limit.ts (NEW FILE)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create Redis instance
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create different rate limiters for different operations
export const rateLimiters = {
  // API endpoints: 10 requests per 10 seconds
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 s"),
    analytics: true,
    prefix: "ratelimit:api",
  }),

  // File uploads: 5 uploads per minute
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "ratelimit:upload",
  }),

  // Auth operations: 5 attempts per 5 minutes
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "5 m"),
    analytics: true,
    prefix: "ratelimit:auth",
  }),

  // Data queries: 30 per minute
  query: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: true,
    prefix: "ratelimit:query",
  }),
};

// Helper to get identifier (IP or user ID)
export function getIdentifier(request: Request): string {
  // Try to get user ID from session
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (userId) return `user:${userId}`;

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(',')[0] : "unknown";
  return `ip:${ip}`;
}
```

**Step 5: Apply to API routes (2 hours)**
```typescript
// src/app/api/files/merge/route.ts
import { rateLimiters, getIdentifier } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Rate limit check
  const identifier = getIdentifier(request);
  const { success, limit, remaining, reset } = await rateLimiters.api.limit(identifier);

  if (!success) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        limit,
        remaining,
        reset: new Date(reset).toISOString(),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      }
    );
  }

  // Continue with normal request handling...
  try {
    // ... existing logic ...
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 6: Apply to file upload service (30 minutes)**
```typescript
// src/lib/supabase/file-storage-service.ts
import { rateLimiters } from '@/lib/rate-limit';

async uploadFile(target: UploadTarget, file: File, projectId: string) {
  // Get user
  const { data: { user } } = await this.supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Rate limit check
  const { success } = await rateLimiters.upload.limit(`user:${user.id}`);
  if (!success) {
    logger.warn('Upload rate limit exceeded', {
      context: 'file-storage-service',
      data: { userId: user.id }
    });
    return {
      success: false,
      error: 'Too many uploads. Please wait a minute and try again.'
    };
  }

  // Continue with upload...
}
```

**Checklist:**
- [ ] Upstash Redis configured
- [ ] Rate limiters created
- [ ] API routes protected
- [ ] File uploads limited
- [ ] Error messages user-friendly
- [ ] Rate limit headers included

---

#### Afternoon: Web Vitals & Monitoring (4 hours)
**Owner:** Any developer

**Step 1: Add Web Vitals tracking (1 hour)**
```typescript
// src/lib/vitals.ts (NEW FILE)
import { onCLS, onFID, onLCP, onFCP, onTTFB, Metric } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }

  // Send to analytics endpoint
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  });

  // Use sendBeacon if available (doesn't block navigation)
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/vitals', body);
  } else {
    fetch('/api/analytics/vitals', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  }
}

export function reportWebVitals() {
  onCLS(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
```

**Step 2: Add analytics API route (1 hour)**
```typescript
// src/app/api/analytics/vitals/route.ts (NEW FILE)
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const metric = await request.json();

    // Log poor performance
    if (metric.rating === 'poor') {
      logger.warn(`Poor ${metric.name} performance`, {
        context: 'web-vitals',
        data: metric,
      });
    }

    // Store in database (optional)
    // await storeMetric(metric);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to log web vital', error as Error, {
      context: 'analytics-api',
    });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Step 3: Initialize in app (30 minutes)**
```typescript
// src/app/layout.tsx
import { reportWebVitals } from '@/lib/vitals';
import { useEffect } from 'react';

export default function RootLayout({ children }) {
  useEffect(() => {
    reportWebVitals();
  }, []);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

**Step 4: Add Vercel Analytics (15 minutes)**
```bash
npm install @vercel/analytics
```

```typescript
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

**Step 5: Create performance dashboard (1 hour)**
```typescript
// src/app/admin/performance/page.tsx (NEW FILE)
// Simple dashboard to view collected metrics
// Query from database or Vercel Analytics API
```

**Checklist:**
- [ ] Web Vitals tracking added
- [ ] Analytics API route created
- [ ] Vercel Analytics installed
- [ ] Metrics logging to Sentry
- [ ] Dashboard created (optional)

---

### Day 5 (Friday) - Testing & Documentation (8 hours)

#### Morning: Test Everything (4 hours)
**Owner:** Full team

**Test Checklist:**

**Security Headers:**
- [ ] Visit https://securityheaders.com/?q=your-preview-url
- [ ] Score: A or A+
- [ ] All 7 headers present
- [ ] CSP not blocking functionality

**Error Tracking:**
- [ ] Trigger test error
- [ ] Check Sentry dashboard
- [ ] Error appears within 30 seconds
- [ ] Stack trace is correct
- [ ] User context included

**Password Policy:**
- [ ] Try weak password → Rejected
- [ ] Try strong password → Accepted
- [ ] Strength meter works
- [ ] Feedback messages clear

**File Upload:**
- [ ] Upload valid CSV → Success
- [ ] Upload 60MB file → Rejected
- [ ] Upload .exe file → Rejected
- [ ] Error messages helpful

**Rate Limiting:**
- [ ] Trigger 10 API calls quickly → 429 error
- [ ] Wait 10 seconds → Works again
- [ ] Error message explains wait time

**Web Vitals:**
- [ ] Check console for metrics
- [ ] Navigate between pages
- [ ] Check Vercel Analytics dashboard

---

#### Afternoon: Update Documentation (4 hours)
**Owner:** Tech lead

**Documents to update:**

**1. README.md (1 hour)**
- Replace Firebase boilerplate
- Add project overview
- Add quick start guide
- Link to comprehensive docs

**2. Update CLAUDE.md (30 minutes)**
- Mark security headers as complete
- Update logger migration progress
- Note Week 1 completion

**3. Create WEEK1_COMPLETION_REPORT.md (1 hour)**
- List all completed work
- Include metrics (headers score, error tracking setup)
- Screenshots of Sentry dashboard
- Performance baseline

**4. Update FINDINGS_REGISTER.md (30 minutes)**
- Mark HIGH-001, HIGH-003 as DONE
- Update HIGH-004 progress (5 files migrated)
- Add test results

**5. Create DEPLOYMENT_CHECKLIST.md (1 hour)**
- Pre-deployment checks
- Environment variables needed
- Verification steps
- Rollback procedure

---

## Week 2: Date Parser & Test Coverage (40 hours)

### Day 6-7 (Mon-Tue) - Unified Date Parser (16 hours)

See FINDINGS_REGISTER.md → FINDING #5 for detailed implementation.

### Day 8-9 (Wed-Thu) - CSV Parser Tests (16 hours)

Create `src/components/pin-data/__tests__/csvParser.test.ts` with 50+ test cases.

### Day 10 (Fri) - Review & Deploy (8 hours)

- Code review of all Week 1 & 2 changes
- Integration testing
- Deploy to production
- Monitor for 24 hours

---

## Success Metrics

**Week 1 Targets:**
- [x] Security headers: A+ score
- [x] Error tracking: 100% of errors captured
- [x] Password policy: 12+ chars, complexity enforced
- [x] File validation: Type and size checks
- [x] Rate limiting: All endpoints protected
- [x] Web Vitals: Tracking operational

**Week 2 Targets:**
- [ ] Unified date parser: All 3 parsers replaced
- [ ] Test coverage: CSV parser 80%+
- [ ] Logger migration: 100% complete
- [ ] No console.logs in src/
- [ ] All HIGH findings resolved

---

## Emergency Contacts

- **Security Issues:** Report to Sentry + team Slack
- **Production Errors:** Check Sentry dashboard
- **Performance Issues:** Check Vercel Analytics

---

**Document Complete**
**Total Time: 80 hours (2 weeks)**
**Next: Proceed to Month 1 improvements**
