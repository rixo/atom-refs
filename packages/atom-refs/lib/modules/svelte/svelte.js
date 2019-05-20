'use babel'
/* eslint-plugin-disable import */

/**
 * Sorry lint, you run too long.
 *
 * Probably that parsing the whole svelte compiler for imports is a bit too
 * demanding...
 *
 * This file exists solely so that other modules depending on svelte compiler
 * don't have to suffer a +5s penalty for linting.
 */

export { parse, compile, walk } from 'svelte/compiler'
