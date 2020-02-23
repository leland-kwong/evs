module.exports = {
  root: true,
  plugins: [
    "jest"
  ],
  extends: [
    'airbnb',
    // needed for eslint-airbnb
    'plugin:react/recommended',
    'eslint:recommended',
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
    ],
    "indent": [
      "error", 
      2, 
      { "ignoredNodes": ["TemplateLiteral > *"] }
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
  },
  "env": {
    "jest/globals": true
  }
};
