/** @babel */

import dedent from 'dedent'

import { walk } from '../../../lib/modules/php/walk'
import { parse } from '../../../lib/modules/php'

fdescribe('modules/php/walk', () => {
  it('is a function', () => {
    expect(typeof walk).toBe('function')
  })

  it('enters Program', () => {
    const code = dedent`
      <?php ?>
    `
    const { ast } = parse({ code })
    let entered = null
    walk(ast, {
      enter(node) {
        entered = node.kind
      },
    })
    expect(entered).not.toBe(null)
    expect(entered.kind).toBe('program')
  })
})
