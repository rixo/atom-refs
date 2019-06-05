'use babel'

import { traverse } from '../../modules/svelte/parse'
import { parse, findReferences } from '../../modules/svelte'
import { requireJSH } from '../util'

import createLang from './create-lang'

const { parseAst: jshParseInfo } = requireJSH('/lib/core/parse-code')

const scopes = ['source.svelte']

const parseInfo = svelteAst => {
  const { ast } = svelteAst
  const svelte = {
    type: 'info',
    exports: [],
    externalModules: [],
    paths: [],
    scopes: [],
  }
  const infos = {
    module: null,
    instance: null,
    svelte,
  }
  if (ast.module) {
    const info = jshParseInfo(ast.module.content, traverse)
    infos.module = info
    Object.assign(svelte, info)
  }
  if (ast.instance) {
    const info = jshParseInfo(ast.instance.content, traverse)
    infos.instance = info
    Object.assign(svelte, {
      // imports in instance are not real imports (they're public props)
      externalModules: [...svelte.externalModules, ...info.externalModules],
      paths: [...svelte.paths, ...info.paths],
    })
  }
  return svelte
}

const parseAst = code => parse({ code })

export default createLang({
  scopes,
  parseAst,
  parseInfo,
  findReferences,
})
