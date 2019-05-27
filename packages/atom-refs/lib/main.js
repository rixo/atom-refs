'use babel'

import { CompositeDisposable } from 'atom'
import { createLocator } from './util'
import commands from './commands'
import { PACKAGE, debug, cursorChangeThrottle, LINT_THROTTLE } from './config'
import modules from './modules'

const scopes = modules.getScopes()

const state = {
  subscriptions: null,
  vim: null,
  module: null,
  editor: null,
  disposable: null,
  activeDisposable: null,
  locator: null,
  cursorBufferPositions: [],
  ast: null,
  parseError: null,
  ranges: [],
  markers: [],
  linter: null,
}

export const activate = () => {
  const subscriptions = new CompositeDisposable()
  state.subscriptions = subscriptions

  let bufferChangedTimeout = null
  // changing: the buffer has been modified, and not reparsed yet, so our
  // state is not valid for findReferences -- we must wait until state is
  // flushed by onDidStopChanging, or watch dog timeout
  let changing = false
  // Apparently, when a TextEditor is activated, there is a string of
  // change event with no corresponding onDidStopChanging call, leaving
  // us in a broken state of having changing flag set to true. So if we
  // get no news in a while, we'll force a state refresh after a security
  // delay
  let bufferChangeWatchDogTimeout = null
  const bufferChangeWatchDogDelay = 500

  const setChanging = newChanging => {
    changing = newChanging
    if (bufferChangeWatchDogTimeout !== null) {
      clearTimeout(bufferChangeWatchDogTimeout)
      bufferChangeWatchDogTimeout = null
    }
    if (changing) {
      bufferChangeWatchDogTimeout = setTimeout(() => {
        if (!changing) return
        applyBufferChanged()
      }, bufferChangeWatchDogDelay)
    }
  }

  const applyBufferChanged = () => {
    const {
      editor,
      module: { parse },
    } = state
    setChanging(false)
    // guard: no editor -- this can happen when all tabs are closed at once
    if (!editor) return
    const code = editor.getText()
    debug('onBufferChanged parse')
    const parsed = parse({ code, editor })
    state.locator = parsed.locator || createLocator(code)
    debug('onBufferChanged parsed', parsed)
    state.ast = parsed.ast
    state.parseError = parsed.error
    updateReferences(state)
  }

  const onBufferChange = () => {
    setChanging(true)
  }

  const onBufferChanged = () => {
    clearTimeout(bufferChangedTimeout)
    bufferChangedTimeout = setTimeout(() => {
      applyBufferChanged()
    }, 200)
  }

  const updateCursorPositions = () => {
    cursorMovedTimeout = null
    const { editor } = state
    state.cursorBufferPositions = editor.getCursorBufferPositions()
  }
  const applyCursorMoved = () => {
    updateCursorPositions()
    // skip updating references if buffer has changed since locator
    // may be out of sync -- update will happen when changes settle
    if (!changing) {
      updateReferences(state)
    }
  }
  let cursorMovedTimeout = null
  const onCursorMoved = cursorChangeThrottle
    ? () => {
        clearTimeout(cursorMovedTimeout)
        cursorMovedTimeout = setTimeout(applyCursorMoved, cursorChangeThrottle)
      }
    : applyCursorMoved

  const onChangeGrammar = () => {
    const { editor } = state
    const grammar = editor.getGrammar()
    const scopeName = grammar.scopeName
    if (scopes.includes(scopeName)) {
      state.module = modules.getModule(scopeName)
      if (!state.module) {
        throw new Error(`Unssuported scope: ${scopeName}`)
      }
      enable(state)
    } else {
      disable(state)
    }
  }

  const onActiveTextEditor = editor => {
    const { disposable } = state
    if (disposable) {
      subscriptions.remove(state.disposable)
      disposable.dispose()
      debug('editorDisposable disposed')
    }
    setChanging(false) // new editor is "not changing" on open
    state.editor = editor
    if (editor) {
      state.disposable = new CompositeDisposable()
      subscriptions.add(state.disposable)
      state.disposable.add(editor.onDidChangeGrammar(onChangeGrammar))
      editor.onDidDestroy(() => {
        if (state.linter) {
          const editorPath = editor.getPath()
          if (editorPath) {
            state.linter.setMessages(editorPath, [])
          }
        }
      })
      onChangeGrammar()
    }
  }

  const enable = state => {
    const { editor, disposable } = state
    state.activeDisposable = new CompositeDisposable()
    ;[
      editor.onDidChange(onBufferChange),
      editor.onDidStopChanging(onBufferChanged),
      editor.onDidChangeCursorPosition(onCursorMoved),
    ].forEach(d => state.activeDisposable.add(d))
    disposable.add(state.activeDisposable)
    updateCursorPositions()
    onBufferChanged()
  }

  const disable = state => {
    const { disposable, activeDisposable } = state
    if (activeDisposable) {
      disposable.remove(activeDisposable)
      activeDisposable.dispose()
      state.activeDisposable = null
    }
  }

  subscriptions.add(atom.workspace.observeActiveTextEditor(onActiveTextEditor))

  Object.entries(commands).forEach(([name, handler]) => {
    const scope = handler.scope || 'atom-workspace'
    subscriptions.add(
      atom.commands.add(scope, {
        [`${PACKAGE}:${name}`]: handler(state),
      })
    )
  })
}

export const deactivate = () => {
  const { subscriptions } = state
  clearMarkers(state)
  if (subscriptions) {
    subscriptions.dispose()
    state.subscriptions = null
  }
}

const handleParseError = state => {
  if (state.lintTimeout) {
    clearTimeout(state.lintTimeout)
  }
  const handler = () => displayParseError(state)
  state.lintTimeout = setTimeout(handler, LINT_THROTTLE)
}

const displayParseError = state => {
  const { editor, linter, parseError, markers } = state
  if (!parseError) {
    return
  }
  const editorPath = editor.getPath()

  if (Array.isArray(parseError)) {
    parseError.forEach(display)
  } else {
    display(parseError)
  }

  function parseErrorRange(error) {
    if (error.range) {
      return error.range
    } else if (error.loc) {
      const {
        loc: { line, column },
      } = error
      const row = line - 1
      const range = [[row, column], [row, column + 1]]
      return range
    } else {
      throw new Error('Parse error misses loc or range')
    }
  }

  function display(error) {
    const { message } = error
    if (error.loc || error.range) {
      const range = parseErrorRange(error)
      if (linter && editorPath) {
        linter.setMessages(editorPath, [
          {
            severity: 'error',
            location: {
              file: editorPath,
              position: range,
            },
            excerpt: message,
            description: message,
          },
        ])
      } else {
        const marker = editor.markBufferRange(range)
        editor.decorateMarker(marker, {
          type: 'highlight',
          class: 'refactor-error',
        })
        editor.decorateMarker(marker, {
          type: 'line-number',
          class: 'refactor-error',
        })
        const item = document.createElement('div')
        item.textContent = message
        item.style.background = '#fff'
        item.style.border = '1px solid darkred'
        item.style.color = 'darkred'
        editor.decorateMarker(marker, { type: 'overlay', item })
        // editor.decorateMarker(marker, {type: 'text', style: {color: 'red'}})
        // TODO message
        markers.push(marker)
      }
    } else {
      if (linter && editorPath) {
        linter.setMessages(editorPath, [
          {
            severity: 'error',
            location: {
              file: editorPath,
              position: [[0, 0], [0, 1]],
            },
            excerpt: message,
            description: message,
          },
        ])
      }
    }
  }
}

const clearMarkers = state => {
  const { markers } = state
  if (markers) {
    state.markers.forEach(marker => marker.destroy())
  }
  state.markers = []
}

const updateReferences = state => {
  // remove existing markers
  clearMarkers(state)
  const {
    editor,
    markers,
    cursorBufferPositions: positions,
    locator,
    ast,
    parseError,
    linter,
    module: { findReferences },
  } = state
  // guard: parse error
  if (parseError) {
    handleParseError(state)
  } else {
    if (linter) {
      const editorPath = editor.getPath()
      if (editorPath) {
        linter.setMessages(editorPath, [])
      }
    }
  }
  // references
  if (locator && ast) {
    const cursorLocations = positions.map(locator)
    cursorLocations.forEach(location => {
      const { locator } = state
      const ranges = findReferences(ast, location, { locator })
      state.ranges = ranges
      ranges.forEach(range => {
        const marker = editor.markBufferRange(range)
        const cls = range.type ? `refactor-${range.type}` : 'refactor-reference'
        editor.decorateMarker(marker, { type: 'highlight', class: cls })
        markers.push(marker)
      })
    })
  }
}

export const consumeVimModePlus = service => {
  state.vim = service
}

export const consumeIndie = registerIndie => {
  const linter = registerIndie({
    name: PACKAGE,
  })
  state.subscriptions.add(linter)
  state.linter = linter
}
