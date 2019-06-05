'use babel'

import { parse, findReferences } from '../../modules/js'
import { requireJSH } from '../util'

const { parseAst: parseInfo } = requireJSH('/lib/core/parse-code')

import createLang from './create-lang.js'

const scopes = ['source.js', 'source.js.jsx', 'javascript', 'source.flow']

const parseAst = (code, editor) => parse({ code, editor })

export default createLang({
  scopes,
  parseAst,
  parseInfo,
  findReferences,
})
