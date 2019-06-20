'use babel'

import createDebug from 'debug'
import dedent from 'dedent'

export const PACKAGE = 'atom-refs'

export const cursorChangeThrottle = 100

export const Debug = (suffix, sep = ':') => createDebug(PACKAGE + sep + suffix)

export const LINT_THROTTLE = 200

export const schema = {
  extensions: {
    order: 1,
    description:
      "Comma separated list of extensions to check for when a file isn't found",
    type: 'array',
    default: ['.js', '.svelte', '.jsx', '.vue', '.json', '.node'],
    items: { type: 'string' },
  },

  theme: {
    order: 2,
    type: 'string',
    default: '',
    enum: [
      { value: '', description: 'neon' },
      { value: 'theme-quiet', description: 'quiet' },
    ],
  },

  usePendingPanes: {
    order: 3,
    type: 'boolean',
    default: false,
  },

  createNotFound: {
    order: 4,
    type: 'boolean',
    default: true,
    title: 'Create missing files',
    description: dedent`
      When jumping for a module path (import, require) and the target does
      not exist, will open a create file dialog for this file.
    `,
  },

  // --- Vim ---

  preferVimSelection: {
    order: 20,
    type: 'boolean',
    default: true,
    description: dedent`
      If [vim-mode-plus](https://atom.io/packages/vim-mode-plus) is present,
      use "persistent selections" instead of Atom's native selection. This way
      you can continue with a vim command targetting all references (e.g.
      change, delete, insert before or after...).
    `,
  },

  // --- Hyperclick ---

  jumpToImport: {
    order: 30,
    type: 'boolean',
    default: false,
    title: 'Jump to import (hyperclick only)',
    description: dedent`
      **Hyperclick only** (built-in jump commands are already opiniated about that.)

      Jump to the import statement instead of leaving the current file.
      You can still click the import to switch files.
    `,
  },
  skipIntermediate: {
    order: 31,
    type: 'boolean',
    default: true,
    title: 'Jump through intermediate links (hyperclick only)',
    description: dedent`
      **Hyperclick only** (built-in jump commands are already opiniated about that.)

      When you land at your destination, atom-refs checks to see if
      that is a link and then follows it. This is mostly useful to skip
      over files that \`export ... from './otherfile'\`. You will land in
      \`./otherfile\` instead of at that export.
    `,
  },

  // --- Debug ---

  debug: {
    order: 99,
    type: 'string',
    default: '',
    title: 'Debug',
    description: dedent`
      [Debug](https://www.npmjs.com/package/debug) keys. They are
      automatically prefixed with \`atom-refs\`. \`*\` for everything.
    `,
  },
}
