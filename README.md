# atom-refs

This projects recomposes big parts of [atom-refactor] / [js-refactor] and [js-hyperclick]. Big thanks to them.

**WARNING This is very early alpha version.** Expect bugs.

## Motivations

- add navigation between occurrences

- add support for svelte3

- avoid to open temporary editors when resolving re-exported modules (`export { ... } from`)

- share AST to avoid double parsing

## Features

- highlights all references (bindings) to a variables in a JS scope

- select all references (to rename all references at once)

- navigate to previous / next reference

- jump to variable declaration / import declaration

- jump through files to imported module

    - either from local import declaration, or a reference later in the code

    - to local modules

- skip through `import { default as foo } from 'foo'` to the actual declaration (optionally, by using one of two jump command variants)

- can provides to [hyperclick] for mouse support (but does not depends on it)

- supports svelte3! including references in the template!!

- supports jsx

- maybe supports vue? (don't remember)

- does NOT support typescript because typescript has all these features more or less built-in

[atom-refactor]: https://atom.io/packages/refactor
[js-refactor]: https://atom.io/packages/js-refactor
[js-hyperclick]: https://atom.io/packages/js-hyperclick
[hyperclick]: https://atom.io/packages/hyperclick
