'use babel'

import { traverse } from '../../modules/svelte/parse'
import { parse, findReferences } from '../../modules/svelte'
import parseJumpContext from '../parse-jump-context'

import createLang from './create-lang'

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
    const info = parseJumpContext(ast.module.content, traverse)
    infos.module = info
    Object.assign(svelte, info)
  }
  if (ast.instance) {
    const info = parseJumpContext(ast.instance.content, traverse)
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
