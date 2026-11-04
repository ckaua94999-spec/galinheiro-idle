import type { NextConfig } from 'next';

const producao = process.env.NODE_ENV === 'production';

// Identifica o build: versiona o service worker (cada deploy instala um SW novo e limpa o cache antigo).
// Guardado em process.env para que os workers do build herdem o mesmo valor.
process.env.NEXT_PUBLIC_VERSAO_APP ??= (process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)).slice(0, 12);

const cabecalhosSeguranca = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(producao
    ? [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            // https: imagens dos popups da equipe (endereço livre, informado no painel administrador)
            "img-src 'self' data: blob: https:",
            "font-src 'self'",
            "connect-src 'self'",
            "worker-src 'self'",
            "manifest-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_VERSAO_APP: process.env.NEXT_PUBLIC_VERSAO_APP },
  // Pacotes do monorepo publicados como TypeScript.
  transpilePackages: ['@galinheiro/game-core', '@galinheiro/api-contract'],
  // Pacotes que precisam rodar direto do node_modules (WASM do PGlite, crypto do web-push).
  serverExternalPackages: ['@electric-sql/pglite', 'web-push', 'postgres'],
  async headers() {
    return [
      { source: '/(.*)', headers: cabecalhosSeguranca },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
