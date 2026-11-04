import type { MetadataRoute } from 'next';

// As rotas /icones/* são servidas como imutáveis: ao trocar a arte dos ícones, suba ICONES_V (e no sw.js).
const ICONES_V = 2;
const icone = (arquivo: string) => `/icones/${arquivo}?v=${ICONES_V}`;

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Galinheiro Idle',
    short_name: 'Galinheiro',
    description: 'Cuide do seu galinheiro, colete ovos-surpresa, gire a roleta e colecione animais raros.',
    lang: 'pt-BR',
    dir: 'ltr',
    start_url: '/galinheiro?origem=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#C4ECFF',
    theme_color: '#49B8FF',
    categories: ['games', 'entertainment'],
    icons: [
      { src: icone('icone-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icone('icone-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icone('icone-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Roleta', short_name: 'Roleta', url: '/roleta', icons: [{ src: icone('icone-192.png'), sizes: '192x192' }] },
      { name: 'Coleção', short_name: 'Coleção', url: '/colecao', icons: [{ src: icone('icone-192.png'), sizes: '192x192' }] },
    ],
  };
}
