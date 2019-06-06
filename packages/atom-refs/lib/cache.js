'use babel'

import fs from 'fs'
import { CompositeDisposable } from 'atom'
import Debug from 'debug'

import { resolveScopeLang } from './hyperclick/langs'
import modules from './modules'
import { createLocator } from './util'

const debug = Debug('atom-refs:cache')

const editors = new WeakSet()
// const data = new WeakMap()
const data = new Map()

const scopesByExtension = {
  html: 'text.html.basic',
  htm: 'text.html.basic',
  vue: 'text.html.vue',
  svelte: 'source.svelte',
  jsx: 'source.js.jsx',
  js: 'source.js.jsx',
}
const defaultScope = 'source.js.jsx'

const getEditorScope = editor => {
  const grammar = editor.getGrammar()
  return grammar.scopeName
}

function getFileScope(filename) {
  const match = /\.([^.?]+)(?:\?.*)?$/.exec(filename)
  const extension = match && match[1]
  if (scopesByExtension[extension]) {
    return scopesByExtension[extension]
  } else {
    const detail =
      `Unable to detect scope for file: ${filename}.` +
      ` Using default scope: ${defaultScope}`
    atom.notifications.addWarning('atom-refs', { detail })
    return defaultScope
  }
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

  // const setScope = _scope => {
  //   if (scope === _scope) {
  //     return
  //   }
  //   scope = _scope
  //   // resolve handlers
  //
  //   // reset deps
  //   invalidate()
  // }

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

  const getScope = () => scope

  const getAst = () => ast || (ast = parseAst())

  const getRefsContext = () =>
    refsContext || (refsContext = parseRefsContext(refsModule, getCode()))

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
    // setScope,
    invalidate,
    // setCode,
    getLocator,
    getScope,
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

// ensure the given editor is used as reference for scope/code
export function attachEditor(subscriptions, editor) {
  watchEditor(subscriptions, editor, true)
}

export function watchEditor(subscriptions, editor, forceAttach) {
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
    if (forceAttach) {
      const path = editor.getPath()
      const item = data.get(path)
      if (!item || item.editor !== editor) {
        refreshItem()
      }
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
      // detach
      detachEditor(editor)
      // cleanup
      disposable.dispose()
      subscriptions.remove(disposable)
    }),
    editor.onDidChange(invalidate),
    editor.onDidChangeGrammar(refreshItem)
  )
  subscriptions.add(disposable)
}

// ensures a destroyed editor is not used as a (scope + code) reference
// for a cache item
function detachEditor(editor) {
  const path = editor.getPath()
  const item = data.get(editor.getPath())
  if (item && item.editor === editor) {
    data.delete(path)
  }
}

const createDetachedItem = path =>
  new CacheItem({
    scope: getFileScope(path),
    getCode: () => (fs.existsSync(path) && fs.readFileSync(path, 'utf8')) || '',
  })

export function getEntry(path) {
  // duck typing TextEditor
  if (path && path.getPath) {
    path = path.getPath()
  }
  if (data.has(path)) {
    return data.get(path)
  } else {
    const item = createDetachedItem(path)
    data.set(path, item)
    return item
  }
}
