// The site is served from a sub-path on GitHub Pages
// (https://<user>.github.io/<repo>/); the deploy workflow sets BASE_PATH.
// Locally it is served from the root.
export default {
  base: process.env.BASE_PATH || '/',
};
