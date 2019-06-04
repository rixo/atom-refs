/** @babel */
/* eslint-disable no-unused-expressions */

import dedent from 'dedent'

import { parse, findReferences } from '../../lib/modules/svelte'

import { createAddRangeMatchers, FindsRefsTest } from './util'

// eslint-disable-next-line no-unused-vars
const { describeRefs, xdescribeRefs, fdescribeRefs } = FindsRefsTest({
  parse,
  findReferences,
})

describe('modules/svelte', () => {
  describe('parse({code})', () => {
    // const {parse} = Python
    it('is a function', () => {
      expect(typeof parse).toBe('function')
    })

    it('parses code to ast', () => {
      const code = 'const simple = true'
      const result = parse({ code })
      expect(result).toBeDefined()
      expect(result.ast).toBeDefined()
      expect(result.error).not.toBeDefined()
    })

    describe('with error', () => {
      const code = dedent`
        <script>
          const a = 1
          const b 2345
          const c = 3
        </script>
      `
      let result
      beforeEach(() => {
        result = parse({ code })
      })

      it('returns a result', () => {
        expect(result).toBeDefined()
      })

      it('reports parse errors', () => {
        expect(result.error).toBeDefined()
      })

      it('adds loc to parse errors', () => {
        const {
          error: { loc },
        } = result
        expect(loc).toBeDefined()
        expect(loc.line).toBe(3)
        expect(loc.column).toBe(10)
      })

      it('adds range to parse errors', () => {
        const {
          error: {
            range,
            range: { start, end },
          },
        } = result
        expect(range).toBeDefined()
        expect(start.row).toBe(3)
        expect(start.column).toBe(10)
        expect(end.row).toBe(3)
        expect(end.column).toBe(10)
      })
    })
  })

  describe('findReferences', () => {
    it('is a function', () => {
      expect(typeof findReferences).toBe('function')
    })
  })

  fdescribe('findReferences(ast, loc)', () => {
    const addRangeMatchers = createAddRangeMatchers({ human: false })
    beforeEach(addRangeMatchers)

    describeRefs('let in instance', '§')`
      <script>
        let _fo§o_ = 'foo' ${'decl: from declaration'}
        let bar = _§foo_ + 'bar' ${'ref: from reference'}
      </script>
      <script context="module">
        console.log(_fo§o_) ${'ref: from module context'}
      </script>
      {_fo§o_} ${'from HTML'}
      {_fo§o_ = 0} ${'mut: from HTML'}
      <div>{_fo§o_}</div> ${'ref: from HTML element'}
    `

    describeRefs('var in instance', '§')`
      <script>
        let _fo§o_ = 'foo' ${'decl: from declaration'}
        let bar = _§foo_ + 'bar' ${'ref: from reference'}
        _f§oo_ = bar ${'mut: from mutation in instance'}
      </script>
      <script context="module">
        console.log(_fo§o_) ${'ref: from module context'}
        _f§oo_ = 1 ${'mut: from mutation in module context'}
      </script>
      {_fo§o_} ${'from HTML'}
      <div>{_fo§o_}</div> ${'from HTML element'}
    `

    describe('const', () => {
      describeRefs('in instance', '§')`
        <script>
          const _fo§o_ = 'foo' ${'decl: from declaration'}
          const bar = _§foo_ + 'bar' ${'ref: from reference'}
        </script>
        <script context="module">
          console.log(_fo§o_) ${'ref: from module context'}
        </script>
        {_fo§o_} ${'from HTML'}
        <div>{_fo§o_}</div> ${'ref: from HTML element'}
      `
      describeRefs('in module', '§')`
        <script context="module">
          const _fo§o_ = 'foo' ${'decl: from declaration'}
          const bar = _§foo_ + 'bar' ${'ref: from reference'}
        </script>
        <script>
          console.log(_f§oo_) ${'ref: from module context'}
        </script>
        {_fo§o_} ${'ref: from HTML'}
        <div>{_fo§o_}</div> ${'ref: from HTML element'}
      `
      describe('shadowing', () => {
        describeRefs('outer', '§')`
          <script>
            const _§a_ = 1 ${'decl: from declaration'}
            console.log(_§a_) ${'ref: from usage'}
            {
              const a = 1
              console.log(a)
            }
          </script>
        `
        describeRefs('inner', '§')`
          <script>
            const a = 1
            console.log(a)
            {
              const _§a_ = 1 ${'decl: from declaration'}
              console.log(_§a_) ${'ref: from usage'}
            }
          </script>
        `
      })
    })

    describeRefs('let in module', '§')`
      <script context="module">
        let _fo§o_ = 'foo' ${'decl: from declaration'}
        let bar = _§foo_ + 'bar' ${'ref: from reference'}
      </script>
      <script>
        console.log(_f§oo_) ${'ref: from module context'}
      </script>
      {_fo§o_} ${'from HTML'}
      <div>{_fo§o_}</div> ${'ref: from HTML element'}
    `

    describeRefs('var in module', '§')`
      <script context="module">
        var _fo§o_ = 'foo' ${'decl: from declaration'}
        var bar = _§foo_ + 'bar' ${'ref: from reference'}
        _fo§o_ = bar ${'mut: from mutation'}
      </script>
      <script>
        console.log(_fo§o_) ${'ref: from module context'}
      </script>
      {_fo§o_} ${'ref: from HTML'}
      <div>{_fo§o_}</div> ${'ref: from HTML element'}
    `

    describeRefs('does not find shadowed variable in function', '§')`
      <script>
        const _foo_ = 'foo'
        (function() {
          let foo = 'bar'
          console.log(foo)
        })
        console.log(_§foo_)
      </script>
    `

    describeRefs('does not find shadowed variable in block scope', '§')`
      <script>
        const _foo_ = 'foo'
        {
          let foo = 'bar'
          console.log(foo)
        }
        console.log(_§foo_)
      </script>
    `

    describeRefs('does not match from char before', '§')`
      <script>
        const§ foo = 'foo' ${'from declaration'}
        console.log§(foo) ${'from reference'}
      </script>
    `

    describeRefs('does not match from char after', '§')`
      <script>
        const foo§ = 'foo' ${'from declaration'}
        console.log(foo) ${'from usage'}
      </script>
    `

    describeRefs('mutation in HTML', '§')`
      {_fo§o_ = 0} ${'mut: from HTML'}
      {@debug _f§oo_} ${'ref: from HTML'}
      <script>
        let _fo§o_ = 'foo' ${'decl: from declaration'}
      </script>
    `

    describeRefs('function refs', '§')`
      <script>
        _xx§x_() ${'ref: from TDZ'}

        function _xx§x_() { ${'decl: from declaration'}
          console.log(_x§xx_) ${'ref: from function body'}
        }

        _x§xx_ = null ${'mut: from mutation'}

        _xx§x_() ${'ref: from reference'}
        {
          _§xxx_() ${'ref: from inner scope'}
          {
            _§xxx_() ${'ref: from deep inner scope'}
          }
        }
        (_xx§x_) ${'ref: from statement'}
        console.log(_xx§x_) ${'ref: from args'}
      </script>
      <script context="module">
        _xx§x_() ${'ref: from module'}
      </script>
    `

    describeRefs('class refs', '§')`
      <script context="module">
        class _Fo§o_ {} ${'decl: from class declaration'}
        _Fo§o_ = null ${'mut: from mutation'}
      </script>
      <script>
        class Bar extends _§Foo_ {} ${'ref: from extends MyClass'}
        const a = _Fo§o_ ${'ref: from reference'}
        const foo = new _F§oo_ ${'ref: from instanciation'}
        console.log(_Fo§o_) ${'ref: from args'}
        {
          _Foo_() ${'ref: from block scope'}
          (new _Fo§o_) ${'ref: from block scope with new'}
        }
      </script>
      <pre>
        Foo: {_F§oo_ + Bar} ${'ref: from HTML expression'}
      </pre>
    `

    describeRefs('class refs in block scope', '§')`
      <script>
        const foo = 'foo'
        {
          class _fo§o_ {} ${'decl: class declared in block scope'}
          (new _§foo_) ${'ref: with new'}
        }
      </script>
    `

    describeRefs('class refs', '§')`
      <script>
        class _Foo_ {}
        {
          class Bar extends _F§oo_ {} ${'ref: from deeper extends'}
        }
      </script>
    `

    describeRefs('require', '§')`
      <script>
        const _§jq_ = require('jquery') ${'decl: from declaration'}
        _§jq_('body') ${'ref: from usage'}
        (_§jq_) ${'ref: from statement'}
      </script>
      <script context="module">
        console.log(_j§q_) ${'ref: from module'}
      </script>
      <div>{_j§q_}</div> ${'ref: from HTML'}
    `

    describeRefs('default import', '§')`
      <script>
        import _§jq_ from 'jquery' ${'defimp: from import'}
        _§jq_('body') ${'ref: from usage'}
        (_§jq_) ${'ref: from statement'}
      </script>
      <script context="module">
        console.log(_j§q_) ${'ref: from module'}
      </script>
      <div>{_j§q_}</div> ${'ref: from HTML'}
    `

    describeRefs('named import', '§')`
      <script>
        import {_§jq_} from 'jquery' ${'namimp: from import'}
        _§jq_('body') ${'ref: from usage'}
        (_§jq_) ${'ref: from statement'}
      </script>
      <script context="module">
        console.log(_j§q_) ${'ref: from module'}
      </script>
      <div>{_j§q_}</div> ${'ref: from HTML'}
    `

    describeRefs('globals', '§')`
      <div>{_con§sole_}</div> ${'ref: from HTML'}
      <script>
        _con§sole_${'from instance'}.log(_§console_) ${'ref: from args'}
        {
          _consol§e_${'ref: from block scope'}
            .log(null, _console_) ${'ref: from args'}
        }
      </script>
      <script context="module">
        _con§sole_${'ref: from module'}
          .log(_§console_) ${'ref: from args in module'}
      </script>
    `

    describeRefs('multiple globals', '§')`
      <div>{_console_}</div>
      <script>
        _con§sole_ ${'not other globals from instance'}
        _console_.log(window)
      </script>
      <script context="module">
        _con§sole_${'not other globals from module'}
        window.log(_console_)
      </script>
    `

    describeRefs('markup if block', '§')`
      <script>
        let _f§oo_ ${'decl: from instance'}
        _f§oo_ = 100 ${'mut: from instance'}
      </script>
      <script context="module">
        console.log(_§foo_) ${'ref: from module'}
        _f§oo_ = 0 ${'mut: from module'}
      </script>
      {#if _fo§o_} ${'ref: from if block condition'}
        {_fo§o_} ${'ref: from if block body'}
      {/if}
      {_f§oo_} ${'ref: from mustache'}
    `

    describeRefs('markup each block', '§')`
      <script>
        let _f§oo_ ${'decl: from instance'}
      </script>
      <script context="module">
        console.log(_§foo_) ${'ref: from module'}
      </script>
      {#each _fo§o_ as bar} ${'ref: from each block clause'}
        {_fo§o_} ${'ref: from each block body'}
      {/each}
      {_f§oo_} ${'ref: from mustache'}
    `

    describeRefs('inline components', '§')`
      <script>
        import _F§oo_ from './Foo' ${'defimp: from import'}
        console.log(_F§oo_) ${'from instance'}
      </script>
      <script context="module">
        console.log(_§Foo_) ${'from module'}
      </script>
      <_Fo§o_> ${'from tag'}
        Foo
      </_F§oo_> ${'from closing tag'}
      <_Fo§o_ bar="bar"> ${'from tag with attributes'}
        Foo
      </_F§oo_     > ${'from closing tag with extra spaces'}
      <_F§oo_ /> ${'from self closing'}
      <_Fo§o_ {bar} /> ${'from self closing tag with attribute'}
      <_F§oo_      /> ${'from self closing tag with extra spacing'}
      {#if _F§oo_} ${'from if block condition'}
        <_Fo§o_> ${'from tag in if block'}
          Foo
        </_F§oo_> ${'from closing tag in if block'}
      {/if}
      {#each _Fo§o_ as bar} ${'from each block clause'}
        <_Fo§o_> ${'from tag in each block'}
          Foo
        </_F§oo_> ${'from closing tag in each block'}
      {/each}
      {_F§oo_} ${'from mustache'}
    `

    describeRefs('each block context vars')`
      <script>
        let items = [{}, {}, {}]
      </script>
      {#each items as _i|tem_} ${'from block context' /* TODO */}
        <pre>{_i|tem_}</pre> ${'ref: from block body'}
        <pre>{_i|tem_.name}</pre> ${'ref: from block body when referenced'}
        {#if _ite|m_} ${'ref: from nested if condition'}
          <p>{_it|em_}</p> ${'ref: from nested if condition body'}
        {/if}
      {/each}
    `

    describeRefs('each block destructured context vars', '§')`
      <script>
        let items = [{}, {}, {}]
      </script>
      {#each items as {_i§tem_}} ${'from block context' /* TODO */}
        <pre>{_i§tem_}</pre> ${'ref: from block body'}
        <pre>{_i§tem_.name}</pre> ${'ref: from block body when referenced'}
        {#if _i§tem_}  ${'ref: from nest if condition'}
          <p>{_it§em_}</p> ${'ref: from nested if condition body'}
        {/if}
      {/each}
    `

    describe('transition', () => {
      describeRefs('transition directive', '§')`
        <div transition:_fa§de_>fade</div> ${'ref:'}
        <div transition:_fa§de_={params}>fade</div> ${'ref:'}
        <div transition:_fa§de_|local>fade</div> ${'ref:'}
        <div transition:_fa§de_|local={params}>fade</div> ${'ref:'}
        <script>
          import { _fa§de_ } from 'svelte/transition' ${'namimp:'}
        </script>
      `

      describeRefs('default import of transition directive', '§')`
        <div transition:_fa§de_>fade</div> ${'ref:'}
        <div transition:_fa§de_={params}>fade</div> ${'ref:'}
        <div transition:_fa§de_|local>fade</div> ${'ref:'}
        <div transition:_fa§de_|local={params}>fade</div> ${'ref:'}
        <script>
          import _fa§de_ from 'svelte/transition/fade' ${'defimp:'}
        </script>
      `

      describeRefs('in directive', '§')`
        <script>
          import { _fl§y_ } from 'svelte/transition' ${'namimp:'}
        </script>
        <div in:_fl§y_>fade</div> ${'ref:'}
        <div in:_fl§y_={params}>fade</div> ${'ref:'}
        <div in:_fl§y_|local>fade</div> ${'ref:'}
        <div in:_fl§y_|local={params}>fade</div> ${'ref:'}
      `

      describeRefs('out directive', '§')`
        <script>
          import { _fl§y_, fade } from 'svelte/transition' ${'namimp:'}
        </script>
        <div out:_fl§y_>fade</div> ${'ref:'}
        <div out:_fl§y_={params}>fade</div> ${'ref:'}
        <div out:_fl§y_|local>fade</div> ${'ref:'}
        <div out:_fl§y_|local={params}>fade</div> ${'ref:'}
      `

      describeRefs('transition directive with variable from module', '§')`
        <script context="module">
          const _fad§e_ = {} ${'decl:'}
        </script>
        <div transition:_fa§de_>fade</div> ${'ref:'}
        <div transition:_fa§de_={params}>fade</div> ${'ref:'}
        <div transition:_fa§de_|local>fade</div> ${'ref:'}
        <div transition:_fa§de_|local={params}>fade</div> ${'ref:'}
      `
    })

    describeRefs('animate directive', '§')`
      <script context="module">
        import { _f§lip_ } from 'svelte/animate' ${'namimp:'}
      </script>
      <script>
        const list = []
      </script>
      {#each list as item (item)}
        <div animate:_fli§p_>{item}</div ${'ref:'}>
      {/each}
    `
  })
})
