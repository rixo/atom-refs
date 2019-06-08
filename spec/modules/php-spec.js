/** @babel */
/* eslint-disable no-unused-expressions */

import { createAddRangeMatchers, FindsRefsTest } from './util'

import { parse, findReferences } from '../../lib/modules/php'

// eslint-disable-next-line no-unused-vars
const { describeRefs, xdescribeRefs, fdescribeRefs } = FindsRefsTest({
  parse,
  findReferences,
})

describe('modules/php findReferences(ast, loc)', () => {
  const addRangeMatchers = createAddRangeMatchers({ human: false })
  beforeEach(addRangeMatchers)

  describeRefs('variable')`
    <?php
    _$§var_ = 'var'; ${'decl:'}
    _$§var_ = 'foo'; ${'mut:'}
    print_r(_$v§ar_); ${'ref:'}
  `

  describeRefs('variable in function')`
    <?php
    $var = 'not me';
    function foo() {
      _$§var_ = 'var'; ${'decl:'}
      _$§var_ = 'foo'; ${'mut:'}
      print_r(_$v§ar_); ${'ref:'}
    }
  `

  describeRefs('$this')`
    <?php
    class Foo {
      function boom() {
        _$thi§s_->bim(); ${'ref:'}
      }
      function bim() {
        _$§this_->boom(); ${'ref:'}
      }
    }
  `

  describeRefs('method declaration')`
    <?php
    class Foo {
      function _bo§om_() { ${':decl'} }
    }
  `

  xdescribeRefs('methods')`
    <?php
    class Foo {
      function _bo§om_() { ${':decl'}
        $this->_bo§om_(); ${'ref:'}
        $this->bim();
      }
      function bim() {
        $this->_b§oom_(); ${'ref:'}
        $this->bim();
      }
    }
  `

  xdescribeRefs('functions')`
    <?php
    function _f§oo_() {} ${'decl:'}
    _fo§o_(); ${'ref:'}
  `

  // describeRefs('class')`
  //   <?php
  //   class _M§yClass_ { ${'decl:'}
  //   }
  //   $o = new _My§Class_(); ${'ref:'}
  // `
})
