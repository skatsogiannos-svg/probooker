/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    "@remix-run/eslint-config",
    "@remix-run/eslint-config/node",
    "prettier",
  ],
  ignorePatterns: [
    "build/",
    "node_modules/",
    "extensions/",
    "research/",
    "prisma/",
  ],
};
