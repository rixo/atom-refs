'use babel'

import { parse, findReferences } from '../../modules/js'
import parseInfo from '../parse-jump-context'

import createLang from './create-lang.js'

const scopes = [
  'source.js',
  'source.js.jsx',
  // 'source.tsx',
  // 'source.ts',
  'javascript',
  'source.flow',
]

const parseAst = (code, editor) => parse({ code, editor })

export default createLang({
  scopes,
  parseAst,
  parseInfo,
  findReferences,
})
