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

  describe('findReferences(ast, loc)', () => {
    const addRangeMatchers = createAddRangeMatchers({ human: false })
    beforeEach(addRangeMatchers)

    describeRefs('let in instance')`
      <script>
        let _fo|o_ = 'foo' ${'from declaration'}
        let bar = _|foo_ + 'bar' ${'from reference'}
      </script>
      <script context="module">
        console.log(_foo_) ${'from module context'}
      </script>
      {_fo|o_} ${'from HTML'}
      <div>{_fo|o_}</div> ${'from HTML element'}
    `

    describeRefs('var in instance')`
      <script>
        let _fo|o_ = 'foo' ${'from declaration'}
        let bar = _|foo_ + 'bar' ${'from reference'}
      </script>
      <script context="module">
        console.log(_foo_) ${'from module context'}
      </script>
      {_fo|o_} ${'from HTML'}
      <div>{_fo|o_}</div> ${'from HTML element'}
    `

    describe('const', () => {
      describeRefs('in instance')`
        <script>
          const _fo|o_ = 'foo' ${'from declaration'}
          const bar = _|foo_ + 'bar' ${'from reference'}
        </script>
        <script context="module">
          console.log(_foo_) ${'from module context'}
        </script>
        {_fo|o_} ${'from HTML'}
        <div>{_fo|o_}</div> ${'from HTML element'}
      `
      describeRefs('in module')`
        <script context="module">
          const _fo|o_ = 'foo' ${'from declaration'}
          const bar = _|foo_ + 'bar' ${'from reference'}
        </script>
        <script>
          console.log(_foo_) ${'from module context'}
        </script>
        {_fo|o_} ${'from HTML'}
        <div>{_fo|o_}</div> ${'from HTML element'}
      `
      describe('shadowing', () => {
        describeRefs('outer')`
          <script>
            const _|a_ = 1 ${'from declaration'}
            console.log(_|a_) ${'from usage'}
            {
              const a = 1
              console.log(a)
            }
          </script>
        `
        describeRefs('inner')`
          <script>
            const a = 1
            console.log(a)
            {
              const _|a_ = 1 ${'from declaration'}
              console.log(_|a_) ${'from usage'}
            }
          </script>
        `
      })
    })

    describeRefs('let in module')`
      <script context="module">
        let _fo|o_ = 'foo' ${'from declaration'}
        let bar = _|foo_ + 'bar' ${'from reference'}
      </script>
      <script>
        console.log(_foo_) ${'from module context'}
      </script>
      {_fo|o_} ${'from HTML'}
      <div>{_fo|o_}</div> ${'from HTML element'}
    `

    describeRefs('var in module')`
      <script context="module">
        var _fo|o_ = 'foo' ${'from declaration'}
        var bar = _|foo_ + 'bar' ${'from reference'}
      </script>
      <script>
        console.log(_foo_) ${'from module context'}
      </script>
      {_fo|o_} ${'from HTML'}
      <div>{_fo|o_}</div> ${'from HTML element'}
    `

    describeRefs('does not find shadowed variable in function')`
      <script>
        const _foo_ = 'foo'
        (function() {
          let foo = 'bar'
          console.log(foo)
        })
        console.log(_|foo_)
      </script>
    `

    describeRefs('does not find shadowed variable in block scope')`
      <script>
        const _foo_ = 'foo'
        {
          let foo = 'bar'
          console.log(foo)
        }
        console.log(_|foo_)
      </script>
    `

    describeRefs('does not match from char before')`
      <script>
        const| foo = 'foo' ${'from declaration'}
        console.log|(foo) ${'from reference'}
      </script>
    `

    describeRefs('does not match from char after')`
      <script>
        const foo| = 'foo' ${'from declaration'}
        console.log(foo) ${'from usage'}
      </script>
    `

    describeRefs('function refs')`
      <script>
        _xx|x_() ${'from TDZ'}

        function _xx|x_() {
          console.log(_x|xx_) ${'from function body'}
        } ${'from function declaration'}

        _xxx_() ${'from reference'}
        {
          _|xxx_() ${'from inner scope'}
          {
            _|xxx_() ${'from deep inner scope'}
          }
        }
        (_xx|x_) ${'from statement'}
        console.log(_xx|x_) ${'from args'}
      </script>
      <script context="module">
        _xx|x_() ${'from module'}
      </script>
    `

    describeRefs('class refs')`
      <script context="module">
        class _Fo|o_ {} ${'from class declaration'}
      </script>
      <script>
        class Bar extends _|Foo_ {} ${'from extends MyClass'}
        const a = _Fo|o_ ${'from reference'}
        const foo = new _F|oo_ ${'from instanciation'}
        console.log(_Fo|o_) ${'from args'}
        {
          _Foo_() ${'from block scope'}
          (new _Fo|o_) ${'from block scope with new'}
        }
      </script>
      <pre>
        Foo: {_F|oo_ + Bar} ${'from HTML expression'}
      </pre>
    `

    describeRefs('class refs in block scope')`
      <script>
        const foo = 'foo'
        {
          class _fo|o_ {} ${'class declared in block scope'}
          (new _|foo_) ${'with new'}
        }
      </script>
    `

    describeRefs('class refs')`
      <script>
        class _Foo_ {}
        {
          class Bar extends _F|oo_ {} ${'from deeper extends'}
        }
      </script>
    `

    describeRefs('require')`
      <script>
        const _|jq_ = require('jquery') ${'from declaration'}
        _|jq_('body') ${'from usage'}
        (_|jq_) ${'from statement'}
      </script>
      <script context="module">
        console.log(_j|q_) ${'from module'}
      </script>
      <div>{_j|q_}</div> ${'from HTML'}
    `

    describeRefs('default import')`
      <script>
        import _|jq_ from 'jquery' ${'from import'}
        _|jq_('body') ${'from usage'}
        (_|jq_) ${'from statement'}
      </script>
      <script context="module">
        console.log(_j|q_) ${'from module'}
      </script>
      <div>{_j|q_}</div> ${'from HTML'}
    `

    describeRefs('named import')`
      <script>
        import {_|jq_} from 'jquery' ${'from import'}
        _|jq_('body') ${'from usage'}
        (_|jq_) ${'from statement'}
      </script>
      <script context="module">
        console.log(_j|q_) ${'from module'}
      </script>
      <div>{_j|q_}</div> ${'from HTML'}
    `

    describeRefs('globals')`
      <div>{_con|sole_}</div> ${'from HTML'}
      <script>
        _con|sole_${'from instance'}.log(_|console_) ${'from args'}
        {
          _consol|e_${'from block scope'}
            .log(null, _console_) ${'from args'}
        }
      </script>
      <script context="module">
        _con|sole_${'from module'}
          .log(_|console_) ${'from args in module'}
      </script>
    `

    describeRefs('multiple globals')`
      <div>{_console_}</div>
      <script>
        _con|sole_ ${'not other globals from instance'}
        _console_.log(window)
      </script>
      <script context="module">
        _con|sole_${'not other globals from module'}
        window.log(_console_)
      </script>
    `

    describeRefs('markup if block')`
      <script>
        let _f|oo_ ${'from instance'}
      </script>
      <script context="module">
        console.log(_|foo_) ${'from module'}
      </script>
      {#if _fo|o_} ${'from if block condition'}
        {_fo|o_} ${'from if block body'}
      {/if}
      {_f|oo_} ${'from mustache'}
    `

    describeRefs('markup each block')`
      <script>
        let _f|oo_ ${'from instance'}
      </script>
      <script context="module">
        console.log(_|foo_) ${'from module'}
      </script>
      {#each _fo|o_ as bar} ${'from each block clause'}
        {_fo|o_} ${'from each block body'}
      {/each}
      {_f|oo_} ${'from mustache'}
    `

    describeRefs('inline components')`
      <script>
        import _F|oo_ from './Foo' ${'from import'}
        console.log(_F|oo_) ${'from instance'}
      </script>
      <script context="module">
        console.log(_|Foo_) ${'from module'}
      </script>
      <_Fo|o_> ${'from tag'}
        Foo
      </_F|oo_> ${'from closing tag'}
      <_Fo|o_ bar="bar"> ${'from tag with attributes'}
        Foo
      </_F|oo_     > ${'from closing tag with extra spaces'}
      <_F|oo_ /> ${'from self closing'}
      <_Fo|o_ {bar} /> ${'from self closing tag with attribute'}
      <_F|oo_      /> ${'from self closing tag with extra spacing'}
      {#if _F|oo_} ${'from if block condition'}
        <_Fo|o_> ${'from tag in if block'}
          Foo
        </_F|oo_> ${'from closing tag in if block'}
      {/if}
      {#each _Fo|o_ as bar} ${'from each block clause'}
        <_Fo|o_> ${'from tag in each block'}
          Foo
        </_F|oo_> ${'from closing tag in each block'}
      {/each}
      {_F|oo_} ${'from mustache'}
    `
  })
})
