'use babel'

import { getDefinitionsForScope } from '../../services'

const scopes = ['text.html.php']

async function getSuggestion(editor, point) {
  const scope = editor.getGrammar().scopeName
  const provider = getDefinitionsForScope(scope)
  if (!provider) {
    return
  }
  const result = await provider.getDefinition(editor, point)
  const definitions = result && result.definitions
  if (!definitions || !definitions.length) {
    // too spammy
    // atom.notifications.addWarning('Definition not found')
    return
  }
  const {
    range,
    path,
    position: { row, column },
  } = definitions[0]
  const callback = () => {
    const editor = atom.workspace.getActiveTextEditor()
    if (editor.getPath() === path) {
      const paneContainer = atom.workspace.paneContainerForItem(editor)
      paneContainer.activate()
      editor.setCursorBufferPosition([row, column])
      editor.scrollToBufferPosition([row, column], { center: true })
    } else {
      atom.workspace
        .open(path, {
          initialLine: row,
          initialColumn: column,
          searchAllPanes: true,
          activatePane: true,
          activateItem: true,
        })
        .catch(err => {
          // eslint-disable-next-line no-console
          console.error('Failed to open editor', err)
        })
    }
  }
  return { range, callback }
}

export default { scopes, getSuggestion }
