/** @type {import('next').NextConfig} */

// The browser only ever talks to this app, Supabase and PayPal.
// Claude (Anthropic) and ChatGPT (OpenAI) are called from the server only,
// so their API keys can never reach a visitor's browser.
// Allow the browser to reach this project's own Supabase address (custom domains included).
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return '';
  }
})();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.paypal.com https://*.paypal.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://*.supabase.co ${supabaseOrigin} https://*.paypal.com https://*.paypalobjects.com`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${supabaseOrigin} https://*.paypal.com https://fonts.googleapis.com https://fonts.gstatic.com`,
  "frame-src blob: https://www.paypal.com https://*.paypal.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'mammoth'],
    // The print PDF embeds the book font, so ship the font files with that route.
    outputFileTracingIncludes: {
      '/api/books/[id]/export': ['./src/assets/fonts/**'],
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
