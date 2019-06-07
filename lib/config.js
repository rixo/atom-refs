'use babel'

import createDebug from 'debug'

export const PACKAGE = 'atom-refs'

export const cursorChangeThrottle = 100

export const Debug = (suffix, sep = ':') => createDebug(PACKAGE + sep + suffix)

export const LINT_THROTTLE = 200
