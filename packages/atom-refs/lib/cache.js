'use babel'

import { CompositeDisposable } from 'atom'
import Debug from 'debug'

import { resolveScopeLang } from './hyperclick/langs'

import modules from './modules'
import { createLocator } from './util'

const debug = Debug('atom-refs:cache')

const editors = new WeakSet()
// const data = new WeakMap()
const data = new Map()

// TODO config
const isHtml = path => /\.(?:html|htm|vue|svelte)(?:\?.*)?$/i.test(path)

const getEditorScope = editor => {
  const grammar = editor.getGrammar()
  return grammar.scopeName
}

// This is a class. Usage: new CacheItem(...)
function CacheItem({ getCode, scope }) {
  // const path = _path

  const refsModule = modules.getModule(scope)
  const jumpLang = resolveScopeLang(scope)

  let locator
  let ast
  let refsContext
  let jumpContext

  let lastHash

  const setScope = _scope => {
    if (scope === _scope) {
      return
    }
    scope = _scope
    // resolve handlers

    // reset deps
    invalidate()
  }

  const invalidate = hash => {
    // exit early if content has not changed base on hash key, but if argument
    // is undefined, that means force invalidate
    if (hash !== undefined) {
      if (lastHash === hash) {
        return
      }
    }
    lastHash = hash
    // reset deps
    locator = null
    ast = null
    refsContext = null
    jumpContext = null
  }

  const getLocator = () => locator || (locator = createLocator())

  const getAst = () => ast || (ast = parseAst())

  const getRefsContext = () => refsContext || (refsContext = parseRefsContext())

  const getJumpContext = () => {
    debug('CacheItem:getJumpContext')
    return jumpContext || (jumpContext = jumpLang.createJumpContext(getCode()))
  }

  const parseAst = () => {
    debug('CacheItem:parseAst')
    if (!refsModule) {
      throw new Error('Unsupported scope: ' + scope)
    }
    const code = getCode()
    return refsModule.parse({ code })
  }

  return Object.assign(this || {}, {
    setScope,
    invalidate,
    // setCode,
    getLocator,
    getAst,
    getRefsContext,
    getJumpContext,
  })
}

function setItem(path, item) {
  data.set(path, item)
}

function invalidateItem(path) {
  const item = data.get(path)
  if (item) {
    item.invalidate()
  }
}

// function setItemScope(path, scope) {
//   const item = data.get(path)
//   if (item) {
//     item.setScope(scope)
//   }
// }

export function watchEditor(subscriptions, editor) {
  const isNew = !editors.has(editor)
  debug('watchEditor', isNew)

  const refreshItem = () => {
    const path = editor.getPath()
    const item = new CacheItem({
      scope: getEditorScope(editor),
      getCode: () => editor.getText(),
    })
    item.editor = editor
    setItem(path, item)
  }

  // if editor is already known: ensure the current cache item is
  // attached to this editor
  if (!isNew) {
    const path = editor.getPath()
    const item = data.get(path)
    if (!item || item.editor !== editor) {
      refreshItem()
    }
    return
  }

  // --- previously unknown path ---

  editors.add(editor)

  const invalidate = () => {
    const path = editor.getPath()
    invalidateItem(path)
  }

  refreshItem()

  // editor lifecycle
  const disposable = new CompositeDisposable()
  disposable.add(
    editor.onDidDestroy(() => {
      editors.delete(editor)
      // cleanup
      disposable.dispose()
      subscriptions.remove(disposable)
    }),
    editor.onDidChange(invalidate),
    editor.onDidChangeGrammar(refreshItem)
  )
  subscriptions.add(disposable)
}

export function get(path) {
  if (data.has(path)) {
    return data.get(path)
  } else {
    debugger
  }
}
