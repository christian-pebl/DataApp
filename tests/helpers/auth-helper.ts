import { Page } from '@playwright/test';

/**
 * Direct authentication helper that bypasses the UI
 * and sets the Supabase session directly via API
 */
export async function authenticateDirectly(page: Page, email: string, password: string) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:9002';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables not configured');
  }

  console.log('🔐 Authenticating directly via Supabase API...');

  // Step 1: Call Supabase auth API directly
  const response = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    data: {
      email,
      password,
      gotrue_meta_security: {}
    }
  });

  if (!response.ok()) {
    const error = await response.json();
    console.error('❌ Auth API error:', error);
    throw new Error(`Authentication failed: ${error.msg || error.error_description || 'Unknown error'}`);
  }

  const authData = await response.json();
  console.log('✅ Got auth tokens from API');

  // Step 2: Navigate to app and inject the session
  await page.goto(baseUrl);

  // Step 3: Set the session in localStorage (Supabase uses this for auth)
  await page.evaluate((session) => {
    // Supabase stores auth in localStorage with a specific key format
    const storageKey = `sb-${session.supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;

    localStorage.setItem(storageKey, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user
    }));

    console.log('✅ Session stored in localStorage');
  }, {
    ...authData,
    supabaseUrl
  });

  // Step 4: Navigate to map-drawing to trigger auth check
  await page.goto(`${baseUrl}/map-drawing`);
  await page.waitForLoadState('networkidle');

  console.log('✅ Authentication complete');
}

/**
 * Simpler cookie-based auth (if Supabase uses cookies)
 */
export async function authenticateWithCookies(page: Page, email: string, password: string) {
  // This would set auth cookies directly
  // Implementation depends on Supabase cookie structure
}
