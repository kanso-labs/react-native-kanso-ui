#!/usr/bin/env node
// Checks what publint and attw cannot see about the built package: that it
// stands without @kanso-labs/kanso-ui-core.
//
// That package is a devDependency, so an app installs this one and never it.
// tsdown bundles what src/tokens/defaults.ts reaches into dist, which is what
// makes that hold, and nothing else would notice a build that stopped doing so:
// publint reads the manifest and the file list, attw the exports map, and both
// pass a module that imports a package the app does not have.

import { readdirSync, readFileSync } from 'node:fs'

const DIST = new URL('../dist/', import.meta.url)
const IMPORT = /(?:from|import\(?)\s*['"]@kanso-labs\/kanso-ui-core[/'"]/u

const importing = readdirSync(DIST, { recursive: true })
  .map(String)
  .filter((file) => /\.(?:d\.ts|js)$/u.test(file))
  .filter((file) => IMPORT.test(readFileSync(new URL(file, DIST), 'utf8')))

if (importing.length > 0) {
  console.error(
    `dist imports @kanso-labs/kanso-ui-core, which no app installs: ${importing.join(', ')}`,
  )
  process.exit(1)
}

console.log('Nothing in dist imports @kanso-labs/kanso-ui-core.')
