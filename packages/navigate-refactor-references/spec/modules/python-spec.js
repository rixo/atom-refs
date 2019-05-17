/** @babel */

import { parse, findReferences } from '../../lib/modules/python'
import fs from 'fs'
import { addRangeMatchers } from './util'

describe('modules/python', () => {
  beforeEach(addRangeMatchers)

  describe('parse({code})', () => {
    // const {parse} = Python
    it('is a function', () => {
      expect(typeof parse).toBe('function')
    })
    it('code to ast', () => {
      const code = 'simple = True'
      const result = parse({ code })
      expect(result).toBeDefined()
      expect(result.ast).toBeDefined()
      expect(result.error).toEqual(null)
    })
    it('report parse errors', () => {
      const code = `
a = 1
b 2
c = 3
`
      const result = parse({ code })
      expect(result).toBeDefined()
      expect(Array.isArray(result.error)).toBe(true)
      expect(result.error.length).toBe(1)
      {
        const {
          error: [err],
        } = result
        expect(err.range).toBeDefined()
        const {
          range: { start, end },
        } = err
        expect(start.row).toBe(2)
        expect(start.column).toBe(2)
        expect(end.row).toBe(2)
        expect(end.column).toBe(3)
      }
    })
    describe('ipython/jupyter', () => {
      it('does not flag line magics as errors', () => {
        const code = `
          %alias bracket echo "Input in brackets: <%l>"
          %autocall 1
          def func(a):
              %time print 'foo' + a
          %time func(1)
          `
        const result = parse({ code })
        expect(result).toBeDefined()
        expect(result.ast).toBeDefined()
        expect(result.error).toBe(null)
      })
      it('does not flag cell magics as errors', () => {
        const code = `
          %%bash
          %%js
          def func(a, b):
            print('foo')
          func()
          `
        const result = parse({ code })
        expect(result).toBeDefined()
        expect(result.ast).toBeDefined()
        expect(result.error).toBe(null)
      })
    })
  })

  describe('findReferences(ast, loc)', () => {
    const code = fs.readFileSync(`${__dirname}/python.py`, 'utf-8')
    let ast
    const expectRanges = (loc, expected) => {
      const ranges = findReferences(ast, loc)
      expect(ranges).toEqualRanges(expected)
    }
    beforeEach(() => {
      const result = parse({ code })
      ast = result.ast
      expect(result.error).toBe(null)
    })
    it('finds global ref', () => {
      const ranges = findReferences(ast, 2)
      expect(ranges).toEqualRanges('1:0 1:7 mut')
    })
    it('finds ref when cursor is at first char', () => {
      const ranges = findReferences(ast, 1)
      expect(ranges).toEqualRanges('1:0 1:7 mut')
    })
    it('finds ref when cursor is at last char', () => {
      const ranges = findReferences(ast, 7)
      expect(ranges).toEqualRanges('1:0 1:7 mut')
    })
    it('does not find ref when cursor is before first char', () => {
      const ranges = findReferences(ast, 0)
      expect(ranges).toEqualRanges([])
    })
    it('does not find ref when cursor is after last char', () => {
      const ranges = findReferences(ast, 8)
      expect(ranges).toEqualRanges([])
    })
    it('finds all global refs', () => {
      const ranges = findReferences(ast, 14)
      expect(ranges).toEqualRanges('3:0 3:7 mut, 4:6 4:13, 5:0 5:7 mut')
    })
    it('finds globals read in inner scope', () => {
      const ranges = findReferences(ast, 54)
      expect(ranges).toEqualRanges('7:0 7:7 mut, 9:10 9:17')
    })
    it('finds globals read from inner scope', () => {
      const ranges = findReferences(ast, 96)
      expect(ranges).toEqualRanges('7:0 7:7 mut, 9:10 9:17')
    })
    it('does not find locals with same name as globals', () => {
      const ranges = findReferences(ast, 106)
      expect(ranges).toEqualRanges('11:0 11:7 mut')
    })
    it('does not find shadowed globals', () => {
      const ranges = findReferences(ast, 150)
      expect(ranges).toEqualRanges('13:4 13:11 mut')
    })
    it('does not find shadowned inner from locals', () => {
      const ranges = findReferences(ast, 216)
      expect(ranges).toEqualRanges('17:4 17:11 mut')
    })
    it('does not find locals shadowed by inner', () => {
      const ranges = findReferences(ast, 273)
      expect(ranges).toEqualRanges('20:8 20:15 mut')
    })
    it('finds inner reads from locals', () => {
      const ranges = findReferences(ast, 238)
      expect(ranges).toEqualRanges('18:4 18:9 mut, 21:14 21:19')
    })
    it('finds locals from inner reads', () => {
      const ranges = findReferences(ast, 305)
      expect(ranges).toEqualRanges('18:4 18:9 mut, 21:14 21:19')
    })
    it('finds inner reads from shadowing locals', () => {
      const ranges = findReferences(ast, 370)
      expect(ranges).toEqualRanges('25:4 25:11 mut, 27:14 27:21')
    })
    it('finds shadowing locals from inner reads', () => {
      const ranges = findReferences(ast, 419)
      expect(ranges).toEqualRanges('25:4 25:11 mut, 27:14 27:21')
    })
    describe('when read & write are mixed locally', () => {
      const expected = '31:10 31:17, 32:4 32:11 mut'
      it('finds references from read', () => {
        expectRanges(477, expected)
      })
      it('finds references from write', () => {
        expectRanges(541, expected)
      })
    })
    describe('with global keyword', () => {
      const expected = '34:0 34:7 mut, 36:20 36:27, 37:4 37:11 mut, 38:6 38:13'
      it('finds references from global keyword', () =>
        expectRanges(608, expected))
      it('finds references from local overwrite', () => {
        expectRanges(620, expected)
      })
      it('finds references from global write', () => {
        expectRanges(554, expected)
      })
      it('finds references from global read', () => {
        expectRanges(639, expected)
      })
    })
    describe('in expression lists', () => {
      describe('global from read', () => {
        const expected = '40:0 40:2 mut, 43:10 43:12, 44:10 44:12, 45:15 45:17'
        it('finds references from global', () => {
          expectRanges(649, expected)
        })
        it('finds references from local read', () => {
          expectRanges(719, expected)
        })
        it('finds references from local read in list', () => {
          expectRanges(750, expected)
        })
      })
      describe('shadowed global', () => {
        it('finds global reference', () => {
          expectRanges(653, '40:4 40:7 mut')
        })
        const expected = '43:4 43:7 mut, 45:4 45:7 mut, 45:19 45:22'
        it('finds local references from write', () => {
          expectRanges(713, expected)
        })
        it('finds local references from list write', () => {
          expectRanges(739, expected)
        })
        it('finds local references from list read', () => {
          expectRanges(754, expected)
        })
      })
    })
    describe('with global classes', () => {
      const expected = '47:6 47:8 decl, 49:5 49:7, 51:9 51:11'
      it('finds references from class definition', () => {
        expectRanges(765, expected)
      })
      it('finds refs from global scope', () => {
        expectRanges(802, expected)
      })
      it('finds refs from nested scope', () => {
        expectRanges(836, expected)
      })
    })
    describe('with local classes', () => {
      const expected = '54:10 54:12 decl, 56:9 56:11'
      it('finds refs from class definition', () => {
        expectRanges(871, expected)
      })
      it('finds refs from local scope', () => {
        expectRanges(916, expected)
      })
      it('does not find local refs from outer scope', () => {
        expectRanges(926, '57:5 57:7')
      })
    })
    describe('with global functions', () => {
      const expected1 = '59:4 59:9 decl, 60:4 60:9, 62:8 62:13, 65:0 65:5'
      it('finds refs from global function definition', () => {
        expectRanges(936, expected1)
      })
      it('finds refs from local reference', () => {
        expectRanges(949, expected1)
      })
      it('finds refs from inner reference', () => {
        expectRanges(982, expected1)
      })
      it('finds refs from global reference', () => {
        expectRanges(1018, expected1)
      })
    })
    describe('with local functions', () => {
      const expected = '61:8 61:13 decl, 63:8 63:13, 64:4 64:9'
      it('finds refs from function def', () => {
        expectRanges(965, expected)
      })
      it('finds refs from local ref', () => {
        expectRanges(1010, expected)
      })
      it('finds refs from inner ref', () => {
        expectRanges(998, expected)
      })
    })
    describe('with nested functions with same name', () => {
      const expectedOutter = '68:4 68:9 decl, 74:0 74:5'
      it('finds global refs from outter function definition', () => {
        expectRanges(1039, expectedOutter)
      })
      it('finds global refs from global ref', () => {
        expectRanges(1134, expectedOutter)
      })
      const expectedLocal = '69:8 69:13 decl, 73:4 73:9'
      it('finds local refs from local function definition', () => {
        expectRanges(1056, expectedLocal)
      })
      it('finds local refs from local ref', () => {
        expectRanges(1126, expectedLocal)
      })
      const expectedInner = '70:8 70:13, 71:12 71:17 decl, 72:12 72:17'
      it('finds inner refs from inner function definition', () => {
        expectRanges(1093, expectedInner)
      })
      it('finds inner refs from local ref', () => {
        expectRanges(1073, expectedInner)
      })
      it('finds inner refs from inner ref', () => {
        expectRanges(1114, expectedInner)
      })
    })
    describe('with function parameters', () => {
      {
        const expected = '85:20 85:21 decl, 86:10 86:11'
        it('finds parameters refs from parameters declaration', () => {
          expectRanges(1285, expected)
        })
        it('finds parameters refs from local refs', () => {
          expectRanges(1327, expected)
        })
      }
      {
        const expected = '85:23 85:24 decl, 86:13 86:14'
        it('finds parameters refs from default parameters declaration', () => {
          expectRanges(1288, expected)
        })
        it('finds parameters refs from default parameters', () => {
          expectRanges(1330, expected)
        })
      }
      {
        const expected = '95:0 95:1 mut, 97:23 97:24, 97:30 97:31'
        it('does not mistake variable references with named parameter', () => {
          expectRanges(1468, expected)
        })
        it('finds refs from variables used as positional parameter', () => {
          expectRanges(1532, expected)
        })
        it('finds refs from variables assigned to named parameter', () => {
          expectRanges(1539, expected)
        })
      }
      it('does not mistake named parameter with variable references', () => {
        // expectRanges(1495, '96:19 96:20')
        expectRanges(1495, '')
      })
      describe('in nested scopes', () => {
        {
          const expected = [
            '99:20 99:21 decl',
            '100:24 100:25',
            '102:28 102:29',
            '103:25 103:26',
            '104:8 104:9',
          ]
          it('finds refs in nested scopes from parameter declaration', () => {
            expectRanges(1563, expected)
          })
          it('finds refs in nested scopes from outter local scope variables', () => {
            expectRanges(1717, expected)
          })
          it('finds refs in nested scopes from outter local scope named param', () => {
            expectRanges(1597, expected)
          })
          it('finds refs in nested scopes from inner named param', () => {
            expectRanges(1668, expected)
          })
          it('finds refs in nested scopes from outter positionnal param', () => {
            expectRanges(1706, expected)
          })
        }
        {
          const expected = '99:23 99:24 decl, 100:38 100:39'
          it('does not mistake inner scope with local scope from params', () => {
            expectRanges(1566, expected)
          })
          it('does not mistake inner scope with local scope from variable', () => {
            expectRanges(1611, expected)
          })
        }
      })
      describe('with param with same name as variable', () => {
        {
          /**
           * This case is very spicy because in the param list, we've got
           * both write (first c5) and read (second c5), both in function
           * scope (the write), AND outer scope (the read)...
           *
           *     c5 = 'c5'
           *     def func5_with_args(c5, x = c5):
           *         print(c5, x)
           *     func5_with_args(1)
           */
          const expected = '107:0 107:2 mut, 108:28 108:30'
          it('finds refs from outter variable', () => {
            expectRanges(1724, expected)
          })
          it('finds refs from variable reference in parameter', () => {
            expectRanges(1762, expected)
          })
        }
        {
          const expected = '108:20 108:22 decl, 109:10 109:12'
          it('does not find refs from param with same name', () => {
            expectRanges(1754, expected)
          })
          it('does not find refs from param with same name', () => {
            expectRanges(1777, expected)
          })
        }
      })
    })
  })
})
