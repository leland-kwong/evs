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
      {
        "ObjectExpression": "first"
      },
    ],
    "object-curly-newline": ["error", {
      "consistent": true,
    }],
    // "comma-dangle": ["error", {
    //   "arrays": "multiline",
    //   // "objects": "never",
    //   // "imports": "never",
    //   // "exports": "never",
    //   // "functions": "never"
    // }],
    // "comma-spacing": ["error", { "after": false }]
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
