module.exports = {
  root: true,
  plugins: [
    "react-hooks"
  ],
  extends: [
    'airbnb',
    'eslint:recommended',
    'plugin:react/recommended',
  ],
  rules: {
    'implicit-arrow-linebreak': ['error', 'below'],
    'import/prefer-default-export': 0,
    "import/no-extraneous-dependencies": [
      "error", {
         "devDependencies": true
      }
    ],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        mjs: 'never',
        jsx: 'never',
      }
    ]
  },
  "settings": {
    "import/resolver": {
      "node": {
        "extensions": [
          ".js",
          ".jsx",
        ]
      },
      "webpack": {}
    },
    "import/extensions": [
      ".js",
      ".mjs",
      ".jsx",
    ],
    "import/core-modules": [],
    "import/ignore": [
      "node_modules",
      "\\.(coffee|scss|css|less|hbs|svg|json)$"
    ]
  }
};
