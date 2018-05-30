'use babel'

// import OccurrencesView from './occurrences-view'
import {CompositeDisposable} from 'atom'
import {createLocator} from './util'
import commands from './commands'
import {PACKAGE, debug, cursorChangeThrottle, LINT_THROTTLE} from './config'
import modules from './modules'

// const OccurrencesView = require('./occurrences-view')
// const {CompositeDisposable} = require('atom')
// const Debug = require('debug')
// const {findReferences} = require('./find-occurrences')
// const {createLocator, locToRange} = require('./util')

const scopes = [
  'source.js',
  'source.js.jsx',
  'source.babel',
  'text.html.basic',
  'text.html.vue',
  'text.html.php',
]

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
}

export const activate = () => {
  const subscriptions = new CompositeDisposable()
  state.subscriptions = subscriptions

  // lazy require of (big import) babylon
  // state.parse = require('./parse').tryParse

  const applyBufferChanged = () => {
    const {editor, module: {parse}} = state
    const code = editor.getText()
    debug('onBufferChanged parse')
    const parsed = parse({code, editor})
    state.locator = parsed.locator || createLocator(code)
    debug('onBufferChanged parsed', parsed)
    state.ast = parsed.ast
    state.parseError = parsed.error
    updateReferences(state)
  }
  // let bufferChangedTimeout = null
  // const onBufferChanged = () => {
  //   clearTimeout(bufferChangedTimeout)
  //   bufferChangedTimeout = setTimeout(applyBufferChanged, 100)
  // }
  const onBufferChanged = applyBufferChanged

  const applyCursorMoved = () => {
    cursorMovedTimeout = null
    const {editor} = state
    state.cursorBufferPositions = editor.getCursorBufferPositions()
    updateReferences(state)
  }
  let cursorMovedTimeout = null
  const onCursorMoved = cursorChangeThrottle
    ? () => {
      clearTimeout(cursorMovedTimeout)
      cursorMovedTimeout = setTimeout(applyCursorMoved, cursorChangeThrottle)
    }
    : applyCursorMoved

  const onChangeGrammar = () => {
    const {editor} = state
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
    const {disposable} = state
    if (disposable) {
      subscriptions.remove(state.disposable)
      disposable.dispose()
      debug('editorDisposable disposed')
    }
    state.editor = editor
    if (editor) {
      state.disposable = new CompositeDisposable()
      subscriptions.add(state.disposable)
      state.disposable.add(
        editor.onDidChangeGrammar(onChangeGrammar)
      )
      editor.onDidDestroy(() => {
        if (state.linter) {
          state.linter.setMessages(editor.getPath(), [])
        }
      })
      onChangeGrammar()
    }
  }

  const enable = state => {
    const {editor, disposable} = state
    state.activeDisposable = new CompositeDisposable()
    ;[
      editor.onDidStopChanging(onBufferChanged),
      editor.onDidChangeCursorPosition(onCursorMoved),
    ].forEach(d => state.activeDisposable.add(d))
    disposable.add(state.activeDisposable)
    onBufferChanged()
  }

  const disable = state => {
    const {disposable, activeDisposable} = state
    if (activeDisposable) {
      disposable.remove(activeDisposable)
      activeDisposable.dispose()
      state.activeDisposable = null
    }
  }

  subscriptions.add(
    atom.workspace.observeActiveTextEditor(onActiveTextEditor)
  )

  Object.entries(commands).forEach(([name, handler]) => {
    const scope = handler.scope || 'atom-workspace'
    subscriptions.add(atom.commands.add(scope, {
      [`${PACKAGE}:${name}`]: handler(state),
    }))
  })
}

export const deactivate = () => {
  const {subscriptions} = state
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
  const {
    editor,
    linter,
    parseError,
    markers,
  } = state
  if (!parseError) {
    return
  }
  const editorPath = editor.getPath()
  const {message} = parseError
  if (parseError instanceof SyntaxError && parseError.loc) {
    const {loc: {line, column}} = parseError
    const row = line - 1
    const range = [[row, column], [row, column + 1]]
    if (linter) {
      linter.setMessages(editorPath, [{
        severity: 'error',
        location: {
          file: editorPath,
          position: range,
        },
        excerpt: message,
        description: message,
      }])
    } else {
      const marker = editor.markBufferRange(range)
      editor.decorateMarker(marker, {type: 'highlight', class: 'refactor-error'})
      editor.decorateMarker(marker, {type: 'line-number', class: 'refactor-error'})
      const item = document.createElement('div')
      item.textContent = message
      item.style.background = '#fff'
      item.style.border = '1px solid darkred'
      item.style.color = 'darkred'
      editor.decorateMarker(marker, {type: 'overlay', item})
      // editor.decorateMarker(marker, {type: 'text', style: {color: 'red'}})
      // TODO message
      markers.push(marker)
    }
  } else {
    if (linter) {
      linter.setMessages(editorPath, [{
        severity: 'error',
        location: {
          file: editorPath,
          position: [[0, 0], [0, 1]],
        },
        excerpt: message,
        description: message,
      }])
    }
  }
}

const clearMarkers = state => {
  const {markers} = state
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
    module: {
      findReferences,
    },
  } = state
  // guard: parse error
  if (parseError) {
    handleParseError(state)
  } else {
    if (linter) {
      const editorPath = editor.getPath()
      linter.setMessages(editorPath, [])
    }
  }
  // references
  if (locator && ast) {
    const cursorLocations = positions.map(locator)
    cursorLocations.forEach(location => {
      const {cursorPositions} = state
      const ranges = findReferences(ast, location, {cursorPositions})
      state.ranges = ranges
      ranges.forEach(range => {
        const marker = editor.markBufferRange(range)
        const cls = range.type
          ? `refactor-${range.type}`
          : 'refactor-reference'
        editor.decorateMarker(marker, {type: 'highlight', class: cls})
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
