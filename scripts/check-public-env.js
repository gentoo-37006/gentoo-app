const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    [
      '[check-public-env] Missing required public environment variables:',
      ...missing.map((key) => `  - ${key}`),
      '',
      'Set these on the build host before running the Expo web export.',
      'For Render static sites, add them under Service -> Environment and redeploy.',
    ].join('\n')
  );
  process.exit(1);
}

console.log('[check-public-env] required public env vars are set.');
