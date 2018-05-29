'use babel'

import OccurrencesView from './occurrences-view'
import {CompositeDisposable} from 'atom'
import Debug from 'debug'
// import {tryParse} from './parse'
import {findReferences} from './find-occurrences'
import {createLocator, locToRange} from './util'
import commands from './commands'
import {PACKAGE, cursorChangeThrottle} from './config'
import _ from 'underscore-plus'

// const OccurrencesView = require('./occurrences-view')
// const {CompositeDisposable} = require('atom')
// const Debug = require('debug')
// const {tryParse} = require('./parse')
// const {findReferences} = require('./find-occurrences')
// const {createLocator, locToRange} = require('./util')

const debug = Debug(PACKAGE)

const scopes = [
  'source.js',
  'source.js.jsx',
  'source.babel',
  'text.html.basic',
  'text.html.vue',
]

const state = {
  subscriptions: null,
  vim: null,
  editor: null,
  disposable: null,
  activeDisposable: null,
  locator: null,
  cursorLocations: [],
  ast: null,
  parseError: null,
  ranges: [],
}

const activate = () => {
  state.subscriptions = new CompositeDisposable()

  // lazy require of (big import) babylon
  state.parse = require('./parse').tryParse

  const applyBufferChanged = () => {
    bufferChangedTimeout = null
    const {editor, parse} = state
    const text = editor.getText()
    debug('onBufferChanged createLocator', parsed)
    state.locator = createLocator(text)
    debug('onBufferChanged parse')
    const parsed = parse(text)
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
    const {editor, locator} = state
    const positions = editor.getCursorBufferPositions()
    if (locator) {
      state.cursorLocations = positions.map(locator)
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
    const {editor} = state
    const grammar = editor.getGrammar()
    const scopeName = grammar.scopeName
    if (scopes.includes(scopeName)) {
      enable(state)
    } else {
      disable(state)
    }
  }

  const onActiveTextEditor = editor => {
    const {disposable} = state
    if (disposable) {
      state.subscriptions.remove(state.disposable)
      disposable.dispose()
      debug('editorDisposable disposed')
    }
    state.editor = editor
    if (editor) {
      state.disposable = new CompositeDisposable()
      state.subscriptions.add(state.disposable)
      state.disposable.add(
        editor.onDidChangeGrammar(onChangeGrammar)
      )
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
    const {editor, disposable, activeDisposable} = state
    if (activeDisposable) {
      disposable.remove(activeDisposable)
      activeDisposable.dispose()
      state.activeDisposable = null
    }
  }

  state.subscriptions.add(
    atom.workspace.observeActiveTextEditor(onActiveTextEditor)
  )

  Object.entries(commands).forEach(([name, handler]) => {
    const scope = handler.scope || 'atom-workspace'
    state.subscriptions.add(atom.commands.add(scope, {
      [`${PACKAGE}:${name}`]: handler(state),
    }));
  })
}

const deactivate = () => {
  state.subscriptions.dispose()
}

const updateReferences = state => {
  const {editor, cursorLocations, ast, parseError} = state
  // remove existing markers
  if (state.markers) {
    state.markers.forEach(marker => marker.destroy())
  }
  // new markers
  const markers = []
  state.markers = markers
  // console.log(parseError, ast)
  // error
  if (parseError) {
    if (parseError instanceof SyntaxError && parseError.loc) {
      const {loc: {line, column}, message} = parseError
      const row = line - 1
      const range = [[row, column], [row, column + 1]]
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
      return
    }
  }
  // references
  if (ast) {
    cursorLocations.forEach(location => {
      const ranges = findReferences(ast, location)
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

const consumeVimModePlus = service => {
  state.vim = service
}

export default {
  subscriptions: null,
  consumeVimModePlus,
  activate,
  deactivate,
}
