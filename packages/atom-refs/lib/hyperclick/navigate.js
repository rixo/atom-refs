'use babel'

import fs from 'fs'
import shell from 'shell'

import buildJump from './build-jump'
import { requireJSH } from './util'
import { get as getEntry } from '../cache'

const resolveModule = requireJSH('/lib/core/resolve-module')
const makeRequire = requireJSH('/lib/require-if-trusted')

let autoJumpCounter = 0

export const navigateTo = (editor, jump) => {
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

const goToBinding = (editor, point) => {
  editor.setCursorBufferPosition(point)
}

const goToFinalDestination = (editor, { filename, destination }) => {
  const options = {
    // TODO package
    pending: atom.config.get('js-hyperclick.usePendingPanes'),
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

// const jumpCursor = (editor, point, jump) => {
//   editor.setCursorBufferPosition(point)
//   autoJump(editor, point, jump)
// }

// const resolveJumpTo = (path, jump) => {
//   if (jump.type === 'binding') {
//     const nextJump = resolveAutoJump(path, jump.destination, jump)
//   } else if (jump.imported) {
//     const path = editor.getPath()
//     followPath(path, jump)
//   } else {
//     throw new Error('Invalid jump')
//   }
// }

// const jumpTo = (editor, jump) => {
//   if (jump.type === 'binding') {
//     jumpCursor(editor, jump.destination, jump)
//   } else if (jump.imported) {
//     const path = editor.getPath()
//     followPath(path, jump)
//   } else {
//     throw new Error('Invalid jump spec')
//   }
// }

const resolveExportPosition = (path, imported) => {
  const { parseError, exports, locator } = getEntry(path).getJumpContext()
  if (parseError) {
    const detail = `Unable to find origin: parse error in ${path}: ${parseError}`
    atom.notifications.addWarning('atom-refs', { detail })
    return null
  }
  const target = exports[imported]
  if (!target) {
    return null
  }
  const position = locator.getPoint(target.start)
  return position
}

// const goToImported = (editor, imported, fromJump) => {
//   // const { exports } = getCached(editor)
//   // const target = exports[imported] || exports.default
//   // if (!target) {
//   //   return
//   // }
//   // const buffer = editor.getBuffer()
//   // const position = buffer.positionForCharacterIndex(target.start)
//   const position = resolveExportPosition(editor.getPath(), imported, fromJump)
//   jumpCursor(editor, position, fromJump)
// }

const resolveNextJump = jump => {
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
    extensions: atom.config.get('js-hyperclick.extensions'),
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

// const followPath = (fromFile, jump) => {
//   let blockNotFoundWarning = false
//   const requireIfTrusted = makeRequire(isTrusted => {
//     if (isTrusted) {
//       followPath(fromFile, jump)
//     }
//     blockNotFoundWarning = true
//     return () => undefined
//   })
//
//   const resolveOptions = {
//     // FIXME NOT our config
//     extensions: atom.config.get('js-hyperclick.extensions'),
//     requireIfTrusted,
//   }
//
//   // resolveModule only use {moduleName} from suggestion
//   const resolved = resolveModule(fromFile, jump, resolveOptions)
//
//   if (blockNotFoundWarning) {
//     // Do nothing
//   } else if (resolved.type === 'url') {
//     if (atom.packages.isPackageLoaded('web-browser')) {
//       atom.workspace.open(resolved.url)
//     } else {
//       shell.openExternal(resolved.url)
//     }
//   } else if (resolved.type === 'file') {
//     let filename = resolved.filename
//
//     if (filename == null) {
//       const detail = `module ${jump.moduleName} was not found`
//       // TODO package
//       atom.notifications.addWarning('atom-refs', { detail })
//       return
//     }
//
//     if (fs.existsSync(filename)) {
//       filename = fs.realpathSync(filename)
//     }
//     const options = {
//       // TODO package
//       pending: atom.config.get('js-hyperclick.usePendingPanes'),
//     }
//     atom.workspace.open(filename, options).then(editor => {
//       goToImported(editor, jump.imported)
//     })
//   }
// }

const resolveAutoJump = (path, fromPoint) => {
  // TODO config package
  if (!atom.config.get('js-hyperclick.skipIntermediate')) {
    return
  }

  if (autoJumpCounter++ > 10) {
    const detail = `Unable to find origin: too many jumps`
    atom.notifications.addWarning('atom-refs', { detail })
    return
  }

  // const info = getCached(editor)
  const info = getEntry(path).getJumpContext()
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

  return nextJump
}

// const autoJump = (editor, fromPoint, fromJump) => {
//   // // TODO config package
//   // if (!atom.config.get('js-hyperclick.skipIntermediate')) {
//   //   return
//   // }
//   //
//   // if (autoJumpCounter++ > 10) {
//   //   const detail = `Unable to find origin: too many jumps`
//   //   atom.notifications.addWarning('atom-refs', { detail })
//   //   return
//   // }
//   //
//   // const info = getCached(editor)
//   // const nextJump = buildJump(info, fromPoint)
//   //
//   // if (!nextJump) {
//   //   return
//   // }
//   // if (
//   //   nextJump.type === 'from-import' &&
//   //   // TODO config package
//   //   atom.config.get('js-hyperclick.jumpToImport')
//   // ) {
//   //   return
//   // }
//
//   const nextJump = resolveAutoJump(editor.getPath(), fromPoint)
//   if (nextJump) {
//     jumpTo(editor, nextJump)
//   }
// }
