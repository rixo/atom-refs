'use babel'

import fs from 'fs'
import path from 'path'
import shell from 'shell'

import buildJump from './build-jump'
import { getEntry } from '../cache'

import resolveModule from 'js-hyperclick/lib/core/resolve-module'
import makeRequire from 'js-hyperclick/lib/require-if-trusted'

const importAddDialog = callback => {
  try {
    const AddDialog = window.require('tree-view/lib/add-dialog')
    callback(AddDialog)
  } catch (err) {
    const detail = `
      Option "Create missing files" requires tree-view package. The
      option has been disabled.
    `
      .trim()
      .join(' ')
    atom.notifications.addWarning('atom-refs', { detail })
    atom.config.set('atom-refs.createNotFound', false)
  }
}

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
    // this one option is global: do not use jump's options
    pending: atom.config.get('atom-refs.usePendingPanes'),
    searchAllPanes: true,
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

function resolveNextJump(fromJump) {
  const { filename: fromFile } = fromJump
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
    extensions: atom.config.get('atom-refs.extensions'),
    requireIfTrusted,
  }

  // resolveModule only use {moduleName} from suggestion
  const resolved = resolveModule(fromFile, fromJump, resolveOptions)

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

  const resolvedFilename = resolved.filename

  if (resolvedFilename == null) {
    const detail = `module ${fromJump.moduleName} was not found`
    atom.notifications.addWarning('atom-refs', { detail })
    return null
  }

  if (!fs.existsSync(resolvedFilename)) {
    if (
      fromJump.type === 'path' &&
      atom.config.get('atom-refs.createNotFound')
    ) {
      importAddDialog(AddDialog => {
        const dialog = new AddDialog(resolvedFilename, true)
        // AddDialog messes something and adds a trailing slash to filename
        // (it's not done to precisely select a file name)
        const dialogPath = dialog.miniEditor.getText()
        const lastChar = dialogPath.substr(-1)
        if (lastChar === '/' || lastChar === path.sep) {
          dialog.miniEditor.setText(
            dialogPath.substring(0, dialogPath.length - 1)
          )
        }
        dialog.attach()
      })
    }
    return null
  }

  const filename = fs.realpathSync(resolvedFilename)
  const options = fromJump.options
  const position = resolveExportPosition(filename, fromJump.imported)

  if (position) {
    const nextJump = resolveAutoJump(filename, position, options)
    if (nextJump) {
      nextJump.filename = filename
      return nextJump
    } else {
      return { filename, destination: position, options }
    }
  } else {
    return { filename, options }
  }
}

function resolveAutoJump(path, fromPoint, options) {
  const { jumpToImport, skipIntermediate } = options

  // guard: auto jump (out of file) disabled
  if (!skipIntermediate) {
    return
  }

  if (autoJumpCounter++ > 10) {
    const detail = `Unable to find origin: too many jumps`
    atom.notifications.addWarning('atom-refs', { detail })
    return
  }

  const info = getEntry(path).getJumpContext()
  const nextJump = buildJump(info, fromPoint, options)

  if (!nextJump) {
    return
  }
  if (nextJump.type === 'from-import' && jumpToImport) {
    return
  }

  return nextJump
}
