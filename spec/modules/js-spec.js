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

  describeRefs('class refs')`
    class _Fo§o_ {} ${'decl: from class declaration'}
    _Fo§o_ = null ${'mut: from mutation'}
  `

  describeRefs('refs inside class body')`
    class Header extends React.Component {
      constructor(_p§rops_) { ${'decl:'}
        console.log(_prop§s_) ${'ref:'}
      }
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

  // TODO this probably don't work with flow...
  // test case: js-hyperclick/lib/core/resolve-module.js:50:45
  describeRefs('bug with flow?')`
    const { extensions = defaultExtensions, _req§uireIfTrusted_ } = options
    const customResolver = _requireIf§Trusted_(resolver)
  `

  describe('bug: globals match object properties', () => {
    describeRefs('a->b')`
      _handl§er_ = 1 ${'mut:'}
      o.handler = 2 // must NOT match this one
    `
    // this case was not broken, but it worths a quick little test
    describeRefs('b->a')`
      handler = 1
      o.hand§ler = 2 ${'not from object property'}
    `
  })

  describeRefs('bug: computed object properties')`
    const _f§oo_ = 1
    const o = {}
    o[_fo§o_] = 2
  `
})
