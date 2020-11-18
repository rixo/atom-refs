'use babel'

const findReferencesProviders = new Set()
const definitionsProviders = new Set()

let listeners = []

const fire = () => {
  const editor = atom.workspace.getActiveTextEditor()
  if (!editor) return
  listeners.forEach(fn => fn(editor))
}

export const observeProviders = fn => {
  listeners.push(fn)
  return {
    dispose() {
      listeners = listeners.filter(x => x !== fn)
    },
  }
}

export const addFindReferences = provider => {
  findReferencesProviders.add(provider)
  fire()
}

export const getFindReferencesForEditor = editor =>
  [...findReferencesProviders].find(({ isEditorSupported }) =>
    isEditorSupported(editor)
  )

export const addDefinitions = provider => {
  definitionsProviders.add(provider)
  fire()
}

export const getDefinitionsForEditor = editor =>
  getDefinitionsForScope(editor.getGrammar().scopeName)

export const getDefinitionsForScope = scope =>
  [...definitionsProviders].find(({ grammarScopes }) =>
    grammarScopes.includes(scope)
  )
