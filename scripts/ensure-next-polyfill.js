const fs = require('fs');
const path = require('path');

const polyfillPath = path.join(
  process.cwd(),
  'node_modules',
  'next',
  'dist',
  'server',
  'node-polyfill-crypto.js'
);

const polyfillDir = path.dirname(polyfillPath);

const polyfillContents = `// Added by scripts/ensure-next-polyfill.js
"use strict";
if (!global.crypto) {
  let webcrypto;
  Object.defineProperty(global, "crypto", {
    enumerable: false,
    configurable: true,
    get() {
      if (!webcrypto) {
        // eslint-disable-next-line import/no-extraneous-dependencies
        webcrypto = require("node:crypto").webcrypto;
      }
      return webcrypto;
    },
    set(value) {
      webcrypto = value;
    },
  });
}
`;

try {
  if (fs.existsSync(polyfillPath)) {
    console.log('Next.js crypto polyfill already present.');
  } else {
    fs.mkdirSync(polyfillDir, { recursive: true });
    fs.writeFileSync(polyfillPath, polyfillContents, 'utf8');
    console.log('Added missing Next.js crypto polyfill to prevent build failures.');
  }
} catch (error) {
  console.error('Failed to ensure Next.js crypto polyfill exists:', error);
  process.exitCode = 1;
}
