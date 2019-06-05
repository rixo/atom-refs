/** @babel */
/* eslint-disable no-unused-expressions */

import { createAddRangeMatchers, FindsRefsTest } from './util'

import { parse, findReferences } from '../../lib/modules/js'

// eslint-disable-next-line no-unused-vars
const { describeRefs, xdescribeRefs, fdescribeRefs } = FindsRefsTest({
  parse,
  findReferences,
})

describe('modules/js findReferences(ast, loc)', () => {
  const addRangeMatchers = createAddRangeMatchers({ human: false })
  beforeEach(addRangeMatchers)

  describeRefs('let')`
    console.log(_fo§o_) ${'ref: from TDZ'}
    let _fo§o_ = 'foo' ${'decl: from declaration'}
    let bar = _§foo_ + 'bar' ${'ref: from reference'}
    _f§oo_ = bar ${'mut:'}
    console.log(_fo§o_) ${'ref: from params'}
  `

  describeRefs('const')`
    console.log(_fo§o_) ${'ref: from TDZ'}
    const _fo§o_ = 'foo' ${'decl: from declaration'}
    const bar = _§foo_ + 'bar' ${'ref: from reference'}
    _f§oo_ = bar ${'mut: constant violations'}
    console.log(_fo§o_) ${'ref: from params'}
  `

  describeRefs('var')`
    console.log(_fo§o_) ${'ref: from TDZ'}
    _f§oo_ = 'foo' ${'mut: from TDZ'}
    var _fo§o_ = 'foo' ${'decl: from declaration'}
    const bar = _§foo_ + 'bar' ${'ref: from reference'}
    _f§oo_ = bar ${'mut: from mutation'}
    console.log(_fo§o_) ${'ref: from params'}
  `

  describeRefs('default import')`
    import _F§oo_ from './Foo' ${'decl:'}
    console.log(_Fo§o_) ${'ref: from root scope'}
    {
      (_F§oo_) ${'ref: from block scope'}
    }
    function foo(cls = _F§oo_) { ${'ref: from param default'}
      console.log(_F§oo_) ${'ref: from inner scope'}
      return _F§oo_ ${'ref: fom return statement'}
    }
  `

  describeRefs('named import')`
    import Bar, { _Fo§o_, foo } from './Foo' ${'decl:'}
    console.log(_Fo§o_) ${'ref: from root scope'}
    {
      (_F§oo_) ${'ref: from block scope'}
    }
    function foo_func(cls = _F§oo_) { ${'ref: from param default'}
      console.log(_F§oo_) ${'ref: from inner scope'}
      return _F§oo_ ${'ref: fom return statement'}
    }
  `

  describeRefs('named import with alias')`
    import Bar, { foo as _F§oo_, bar } from './Foo' ${'decl:'}
    console.log(_Fo§o_) ${'ref: from root scope'}
    {
      (_F§oo_) ${'ref: from block scope'}
    }
    function foo(cls = _F§oo_) { ${'ref: from param default'}
      console.log(_F§oo_) ${'ref: from inner scope'}
      return _F§oo_ ${'ref: fom return statement'}
    }
  `

  describeRefs('default export')`
    function _fo§o_() {} ${'decl:'}
    console.log(_f§oo_) ${'ref:'}
    export { _f§oo_ } ${'ref: named export'}
    export default _fo§o_ ${'ref: export default'}
  `

  describeRefs('named inline export')`
    export function _fo§o_() {} ${'decl: inline export'}
    console.log(_f§oo_) ${'ref:'}
    export default _fo§o_ ${'ref: export default'}
  `

  describeRefs('named inline export as')`
    function _fo§o_() {} ${'decl: inline export'}
    export { _f§oo_ as bar } ${'ref: named export as'}
    const bar = _fo§o_ ${'ref:'}
    export { bar as foo}
  `

  describeRefs('globals')`
    _c§onsole_.log( ${'ref:'}
      _con§sole_ ${'ref:'}
    )
    _consol§e_.info( window ) ${'ref: not other globals'}
    _cons§ole_ = null ${'mut:'}
  `

  describeRefs('globals in nested scope')`
    function con() {
      _c§onsole_.log( ${'ref:'}
        _con§sole_ ${'ref:'}
      )
      _consol§e_.info( window ) ${'ref: not other globals'}
      _cons§ole_ = null ${'mut:'}
    }
  `
})
