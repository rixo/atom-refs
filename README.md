# atom-refs

This project recomposes big parts of [atom-refactor] / [js-refactor] and [js-hyperclick]. Big thanks to them.

**WARNING This is very early alpha version.** Expect bugs.

## Motivations

- add navigation between occurrences

- add support for svelte3

- avoid to open temporary editors when resolving re-exported modules (`export { ... } from`)

- share AST to avoid double parsing of same code

## Features

- highlights all references (bindings) to a variables in a JS scope

- select all references (to rename all references at once)

- navigate to previous / next reference

- jump to variable declaration / import statement

- jump through files to imported module definition

    - either from local import declaration, or a reference later in the code

    - to `./local-module`, `'global-ones'` and even atom's doc! (actually using js-hyperclick for module resolution currently)

- skip through `import { default as foo } from 'foo'` to the actual declaration (optionally, by using one of two jump command variants)

- can provide to [hyperclick] for mouse support (but does not depends on it)

- supports svelte3! including references in the template!!

- supports jsx

- maybe supports vue? (don't remember, not tested recently, probably somewhat partial support)

- does NOT support typescript (because typescript has all of this more or less built-in)

[atom-refactor]: https://atom.io/packages/refactor
[js-refactor]: https://atom.io/packages/js-refactor
[js-hyperclick]: https://atom.io/packages/js-hyperclick
[hyperclick]: https://atom.io/packages/hyperclick

## Keymap

Provided keymap works with vim-mode-plus because it's what I use. You'll need to map atom-refs's command yourself if not using vim-mode-plus. (Please post an issue if you find a combination that works well in non-vim, to have it integrated in the defaults).
