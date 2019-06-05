'use babel'

import fs from 'fs'
import shell from 'shell'

import buildJump from './build-jump'
import { requireJSH } from './util'
import { getCached } from './cache'

const resolveModule = requireJSH('/lib/core/resolve-module')
const makeRequire = requireJSH('/lib/require-if-trusted')

let autoJumpCounter = 0

export const navigateTo = (editor, jump) => {
  autoJumpCounter = 0
  jumpTo(editor, jump)
}

const jumpCursor = (editor, point) => {
  editor.setCursorBufferPosition(point)
  autoJump(editor, point)
}

const jumpTo = (editor, jump) => {
  if (jump.type === 'binding') {
    jumpCursor(editor, jump.destination)
  } else if (jump.imported) {
    const path = editor.getPath()
    followPath(path, jump)
  } else {
    throw new Error('Invalid jump')
  }
}

const goToImported = (editor, imported) => {
  const { exports } = getCached(editor)
  const target = exports[imported] || exports.default
  if (!target) {
    return
  }
  const buffer = editor.getBuffer()
  const position = buffer.positionForCharacterIndex(target.start)
  jumpCursor(editor, position)
}

const followPath = (fromFile, jump) => {
  let blockNotFoundWarning = false
  const requireIfTrusted = makeRequire(isTrusted => {
    if (isTrusted) {
      followPath(fromFile, jump)
    }
    blockNotFoundWarning = true
    return () => undefined
  })

  const resolveOptions = {
    // FIXME NOT our config
    extensions: atom.config.get('js-hyperclick.extensions'),
    requireIfTrusted,
  }

  // resolveModule only use {moduleName} from suggestion
  const resolved = resolveModule(fromFile, jump, resolveOptions)

  if (blockNotFoundWarning) {
    // Do nothing
  } else if (resolved.type === 'url') {
    if (atom.packages.isPackageLoaded('web-browser')) {
      atom.workspace.open(resolved.url)
    } else {
      shell.openExternal(resolved.url)
    }
  } else if (resolved.type === 'file') {
    let filename = resolved.filename

    if (filename == null) {
      const detail = `module ${jump.moduleName} was not found`
      // TODO package
      atom.notifications.addWarning('js-hyperclick', { detail })
      return
    }

    if (fs.existsSync(filename)) {
      filename = fs.realpathSync(filename)
    }
    const options = {
      // TODO package
      pending: atom.config.get('js-hyperclick.usePendingPanes'),
    }
    atom.workspace.open(filename, options).then(editor => {
      goToImported(editor, jump.imported)
    })
  }
}

const autoJump = (editor, fromPoint) => {
  // TODO config package
  if (!atom.config.get('js-hyperclick.skipIntermediate')) {
    return
  }

  if (autoJumpCounter++ > 10) {
    const detail = `Unable to find origin: too many jumps`
    atom.notifications.addWarning('atom-refs', { detail })
    return
  }

  const info = getCached(editor)
  const nextJump = buildJump(info, fromPoint)

  if (!nextJump) {
    return
  }
  if (
    nextJump.type === 'from-import' &&
    // TODO config package
    atom.config.get('js-hyperclick.jumpToImport')
  ) {
    return
  }

  jumpTo(editor, nextJump)
}
