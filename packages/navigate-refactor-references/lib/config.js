'use babel'

import createDebug from 'debug'

export const PACKAGE = 'occurrences'

export const cursorChangeThrottle = 100

export const debug = createDebug(PACKAGE)
export const Debug = (suffix, sep = '.') => createDebug(PACKAGE + sep + suffix)

export const LINT_THROTTLE = 0
