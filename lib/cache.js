'use babel'

import fs from 'fs'
import { CompositeDisposable } from 'atom'

import { parseRefsContext } from './refs'
import { resolveScopeLang } from './hyperclick/langs'
import modules from './modules'
import { createLocator } from './util'
import { Debug } from './config'

import Data from './cache/data'

const debug = Debug('cache')

const editors = new WeakSet()
const data = new Data()

const scopesByExtension = {
  html: 'text.html.basic',
  htm: 'text.html.basic',
  vue: 'text.html.vue',
  svelte: 'source.svelte',
  svench: 'source.svelte',
  jsx: 'source.js.jsx',
  js: 'source.js.jsx',
  svx: 'text.md',
  svexy: 'text.md',
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
function CacheItem({ owner, path, getCode, scope, isValid }) {
  // depends on: scope
  const refsModule = modules.getModule(scope)
  const jumpLang = resolveScopeLang(scope)

  // depends on: scope, code
  let locator
  let ast
  let refsContext
  let jumpContext

  const invalidate = () => {
    // reset deps
    locator = null
    ast = null
    refsContext = null
    jumpContext = null
  }

  const getPath = () => path

  const isOwner = obj => obj === owner

  const getLocator = () => locator || (locator = createLocator(getCode()))

  const getScope = () => scope

  const getAst = () => ast || (ast = parseAst())

  const getRefsContext = () => {
    return (
      refsContext ||
      (refsContext = parseRefsContext.call(this, refsModule, getCode()))
    )
  }

  const getJumpContext = () => {
    debug('CacheItem:getJumpContext')
    if (!jumpContext) {
      jumpContext = jumpLang
        ? jumpLang.createJumpContext(getCode(), scope)
        : { unsupportedScope: scope }
    }
    return jumpContext
  }

  const parseAst = () => {
    debug('CacheItem:parseAst')
    if (!refsModule) {
      throw new Error('Unsupported scope: ' + scope)
    }
    const code = getCode()
    return refsModule.parse({ code, scopeName: scope })
  }

  const me = this || {}

  Object.assign(me, {
    invalidate,
    getPath, // for debug
    isOwner, // for replace
  })

  assignInterceptables(isValid, invalidate, me, {
    getLocator,
    getScope,
    getAst,
    getRefsContext,
    getJumpContext,
  })

  return me
}

// isValid: if provided, isValid is called before interceptable methods
//   and cache is cleared if isValid returns falsy -- this is "pull"
//   change detection, for filesystem, as opposed to "push" for text
//   editor buffers that have events
function assignInterceptables(isValid, invalidate, target, handlers) {
  if (!isValid) {
    return Object.assign(target, handlers)
  }
  Object.entries(handlers).forEach(([key, getter]) => {
    target[key] = (...args) => {
      if (!isValid()) {
        invalidate()
      }
      return getter(...args)
    }
  })
}

// ensure the given editor is used as reference for scope/code
export function attachEditor(subscriptions, editor) {
  watchEditor(subscriptions, editor, true)
}

export function watchEditor(subscriptions, editor, forceAttach) {
  const alreadyExists = editors.has(editor)
  debug('watchEditor', alreadyExists)

  const refreshItem = () => {
    const path = editor.getPath()
    const createItem = () => createEditorItem(editor)
    // only replace if we're the currently attached editor, otherwise it
    // should mean that there's another editor instance opened with the
    // same buffer/file, and that has been active more recently than ours
    data.replace(editor, path, createItem)
  }

  if (alreadyExists) {
    // forceAttach: ensure the current cache item is attached to
    //   _this_ editor as reference for scope & code
    if (forceAttach) {
      const path = editor.getPath()
      const item = data.get(path)
      if (!item || !item.isOwner(editor)) {
        refreshItem()
      }
    }
    return
  }

  // --- previously unknown path ---

  editors.add(editor)

  const invalidate = () => {
    const path = editor.getPath()
    data.invalidate(path, editor)
  }

  refreshItem()

  // editor lifecycle
  const disposable = new CompositeDisposable()
  disposable.add(
    editor.onDidDestroy(() => {
      // forgetting the editor may not be strictly needed since it's being
      // destroyed... but surely it won't harm!
      editors.delete(editor)
      // detach
      detachEditor(editor)
      // cleanup
      disposable.dispose()
      subscriptions.remove(disposable) // prevent mem leak in subscriptions
    }),
    editor.onDidChange(invalidate),
    editor.onDidChangeGrammar(refreshItem),
    {
      // on dispose, all the above watchers will be removed, but the editor
      // won't necessarilly be destroyed (when package is disabled/enabled
      // with editors that remain opened). so we need to forget it so that
      // it will be correctly rewired if needed.
      dispose() {
        editors.delete(editor)
      },
    }
  )
  subscriptions.add(disposable)
}

// ensures a destroyed editor is not used as a (scope + code) reference
// for a cache item
function detachEditor(editor) {
  const path = editor.getPath()
  const item = data.get(editor.getPath())
  if (item && item.isOwner(editor)) {
    data.delete(path)
  }
}

const createEditorItem = editor =>
  new CacheItem({
    owner: editor,
    path: editor.getPath(),
    scope: getEditorScope(editor),
    getCode: () => editor.getText(),
  })

const createDetachedItem = path => {
  let lastModTime = null
  let lastExists = null

  // TODO async?
  const getCode = () =>
    (fs.existsSync(path) && fs.readFileSync(path, 'utf8')) || ''

  // use last mod time to ensure that the cache is still valid. this is
  // simpler (and more reliable?) that managing file watchers.
  const isValid = () => {
    const exists = fs.existsSync(path)
    const mtime = fs.statSync(path).mtime

    const previousExists = lastExists
    const previousModTime = lastModTime

    lastExists = exists
    lastModTime = mtime

    // if previous exists is null, then so does previous mod time
    if (previousExists === null) {
      return true
    }
    return exists === previousExists && mtime === previousModTime
  }

  return new CacheItem({
    path,
    scope: getFileScope(path),
    getCode,
    isValid,
  })
}

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
