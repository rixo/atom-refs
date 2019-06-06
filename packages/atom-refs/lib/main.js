'use babel'

// watch debug config
{
  const Debug = require('debug')
  atom.config.observe('atom-refs.debug', value => {
    Debug.disable('atom-refs:*')
    if (value) {
      Debug.enable(`atom-refs:${value}`)
    }
  })
}

import { CompositeDisposable } from 'atom'
import dedent from 'dedent'

import { watchEditor, attachEditor, getEntry } from './cache'
import commands from './commands'
import createHyperclickProvider from './hyperclick/hyperclick-provider'
import { PACKAGE, Debug, cursorChangeThrottle, LINT_THROTTLE } from './config'

const debug = Debug('main')

debug('entering')

export const config = {
  extensions: {
    description:
      "Comma separated list of extensions to check for when a file isn't found",
    type: 'array',
    default: ['.js', '.svelte', '.jsx', '.vue', '.json', '.node'],
    items: { type: 'string' },
  },
  usePendingPanes: {
    type: 'boolean',
    default: false,
  },
  jumpToImport: {
    type: 'boolean',
    default: false,
    description: dedent`
      Jump to the import statement instead of leaving the current file.
      You can still click the import to switch files.
    `,
  },
  skipIntermediate: {
    type: 'boolean',
    default: true,
    title: 'Jump through intermediate links',
    description: dedent`
      When you land at your destination, atom-refs checks to see if
      that is a link and then follows it. This is mostly useful to skip
      over files that \`export ... from './otherfile'\`. You will land in
      \`./otherfile\` instead of at that export.
    `,
  },
  debug: {
    type: 'string',
    default: '',
    title: 'Debug',
    description: dedent`
      [Debug](https://www.npmjs.com/package/debug) keys. They are
      automatically prefixed with \`atom-refs\`. \`*\` for everything.
    `,
  },
}

let subscriptions = new CompositeDisposable()

const state = {
  vim: null,
  get module() {
    throw new Error('deprecated: state.module')
  },
  editor: null,
  disposable: null,
  activeDisposable: null,
  get locator() {
    throw new Error('deprecated: state.locator')
  },
  cursorBufferPositions: [],
  get ast() {
    throw new Error('deprecated: state.ast')
  },
  get parseError() {
    throw new Error('deprecated: state.parseError')
  },
  ranges: [], // TODO move to refsContext & deprecate
  markers: [], // TODO move to refsContext & deprecate
  linter: null,
  get refs() {
    return getRefsContext()
  },
}

const getRefsContext = () => getEntry(state.editor).getRefsContext()

export const activate = () => {
  subscriptions = new CompositeDisposable()
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
    const { editor } = state
    setChanging(false)
    // guard: no editor -- this can happen when all tabs are closed at once
    if (!editor) return
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
    const { unsupportedScope } = getRefsContext()
    if (unsupportedScope) {
      disable(state)
    } else {
      enable(state)
    }
  }

  const onTextEditor = editor => {
    debug('watchEditor', editor.getPath())
    watchEditor(subscriptions, editor)
  }

  const onActiveTextEditor = editor => {
    state.ast = null
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
      // cache: ensure font editor is the one attached to the cache entry
      debug('attachEditor', editor.getPath())
      attachEditor(subscriptions, editor)
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

  subscriptions.add(
    atom.workspace.observeTextEditors(onTextEditor),
    atom.workspace.observeActiveTextEditor(onActiveTextEditor)
  )

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
  clearMarkers(state)
  if (subscriptions) {
    subscriptions.dispose()
    subscriptions = new CompositeDisposable()
  }
}

const handleParseError = state => {
  if (state.lintTimeout) {
    clearTimeout(state.lintTimeout)
  }
  const handler = () => displayParseError(state)
  state.lintTimeout = setTimeout(handler, LINT_THROTTLE)
}

const displayParseError = ({ editor, linter, parseError, markers }) => {
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

const clearMarkers = ({ markers }) => {
  if (markers) {
    state.markers.forEach(marker => marker.destroy())
  }
  state.markers = []
}

const getDisplayType = type => {
  switch (type) {
    case 'namimp':
    case 'defimp':
      return 'decl'
    default:
      return type
  }
}

const updateReferences = state => {
  // remove existing markers
  clearMarkers(state)
  const { editor, markers, cursorBufferPositions: positions, linter } = state
  // guard: editor lost in asyncorcery
  if (!editor) {
    return
  }
  const { parseError, pointToPos, findReferencesAt } = getRefsContext()
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
  positions.forEach(point => {
    const pos = pointToPos(point)
    const ranges = findReferencesAt(pos)
    state.ranges = ranges
    ranges.forEach(range => {
      const marker = editor.markBufferRange(range)
      const cls = range.type
        ? `refactor-${getDisplayType(range.type)}`
        : 'refactor-reference'
      editor.decorateMarker(marker, { type: 'highlight', class: cls })
      markers.push(marker)
    })
  })
}

export const consumeVimModePlus = service => {
  state.vim = service
}

export const consumeIndie = registerIndie => {
  const linter = registerIndie({
    name: PACKAGE,
  })
  subscriptions.add(linter)
  state.linter = linter
}

export const getHyperclickProvider = createHyperclickProvider({
  // NOTE subscriptions might change after disable/enable cycle
  add: (...disposables) => subscriptions.add(...disposables),
})
