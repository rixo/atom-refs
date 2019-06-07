'use babel'

import { lazy } from './util'

export const scopes = ['text.html.php']

/**
 * Considers `$this->name()` a call, but not `echo $this->name`.
 */
export const parse = lazy(() => require('./php/parse'))
export const findReferences = lazy(() => require('./php/find-references'))
