'use babel'

import fs from 'fs'
import shell from 'shell'

import buildJump from './build-jump'
import { requireJSH } from './util'
import { getEntry } from '../cache'

const resolveModule = requireJSH('/lib/core/resolve-module')
const makeRequire = requireJSH('/lib/require-if-trusted')

let autoJumpCounter = 0

export function navigateTo(editor, jump) {
  autoJumpCounter = 0
  if (jump.type === 'binding') {
    goToBinding(editor, jump.destination)
  } else {
    const finalDest = resolveFinalDestination(editor.getPath(), jump)
    if (finalDest) {
      goToFinalDestination(editor, finalDest)
    }
  }
}

function goToBinding(editor, point) {
  editor.setCursorBufferPosition(point)
}

function goToFinalDestination(editor, { filename, destination }) {
  const options = {
    // TODO package
    pending: atom.config.get('atom-refs.usePendingPanes'),
  }
  atom.workspace.open(filename, options).then(editor => {
    if (destination) {
      editor.setCursorBufferPosition(destination)
    }
  })
}

function resolveFinalDestination(path, jump) {
  let nextJump = { ...jump, filename: path }
  while ((nextJump = resolveNextJump(nextJump))) {
    const isFinal = !nextJump.type || nextJump.type === 'binding'
    if (isFinal) {
      if (!nextJump.filename) {
        throw new Error('Illegal state')
      }
      return nextJump
    }
  }
}

function resolveExportPosition(path, imported) {
  const { parseError, exports, posToPoint } = getEntry(path).getJumpContext()
  if (parseError) {
    const detail = `Unable to find origin: parse error in ${path}: ${parseError}`
    atom.notifications.addWarning('atom-refs', { detail })
    return null
  }
  const target = exports[imported]
  if (!target) {
    return null
  }
  const position = posToPoint(target.start)
  return position
}

function resolveNextJump(jump) {
  const { filename: fromFile } = jump
  // TODO wtf is all this?
  let blockNotFoundWarning = false

  const fallback = isTrusted => {
    // if (isTrusted) {
    //   resolveNextJump(fromFile, jump)
    // }
    blockNotFoundWarning = true
    return () => undefined
  }
  const requireIfTrusted = makeRequire(fallback)

  const resolveOptions = {
    // FIXME NOT our config
    extensions: atom.config.get('atom-refs.extensions'),
    requireIfTrusted,
  }

  // resolveModule only use {moduleName} from suggestion
  const resolved = resolveModule(fromFile, jump, resolveOptions)

  if (blockNotFoundWarning) {
    // Do nothing
    return null
  }

  if (resolved.type === 'url') {
    if (atom.packages.isPackageLoaded('web-browser')) {
      atom.workspace.open(resolved.url)
    } else {
      shell.openExternal(resolved.url)
    }
    return null
  }

  if (resolved.type !== 'file') {
    debugger // what's this?
    return null
  }

  let filename = resolved.filename

  if (filename == null) {
    const detail = `module ${jump.moduleName} was not found`
    atom.notifications.addWarning('atom-refs', { detail })
    return
  }

  if (fs.existsSync(filename)) {
    filename = fs.realpathSync(filename)
  }

  const position = resolveExportPosition(filename, jump.imported)
  if (position) {
    const nextJump = resolveAutoJump(filename, position)
    if (nextJump) {
      nextJump.filename = filename
      return nextJump
    } else {
      return { filename, destination: position }
    }
  } else {
    return { filename }
  }
}

function resolveAutoJump(path, fromPoint) {
  // TODO config package
  if (!atom.config.get('atom-refs.skipIntermediate')) {
    return
  }

  if (autoJumpCounter++ > 10) {
    const detail = `Unable to find origin: too many jumps`
    atom.notifications.addWarning('atom-refs', { detail })
    return
  }

  const info = getEntry(path).getJumpContext()
  const nextJump = buildJump(info, fromPoint)

  if (!nextJump) {
    return
  }
  if (
    nextJump.type === 'from-import' &&
    // TODO config package
    atom.config.get('atom-refs.jumpToImport')
  ) {
    return
  }

  return nextJump
}
