// Generates dist/sw.js after `expo export -p web`. Precaches the app shell so the PWA opens offline;
// API requests are not cached. New deploys take over on the next load (skipWaiting + clientsClaim).
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,html,css,ttf,ico,png,json}'],
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  swDest: 'dist/sw.js',
  skipWaiting: true,
  clientsClaim: true,
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
};
