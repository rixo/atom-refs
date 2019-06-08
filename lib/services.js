'use babel'

const findReferencesProviders = new Set()
const definitionsProviders = new Set()

export const addFindReferences = provider => {
  findReferencesProviders.add(provider)
}

export const getFindReferencesForEditor = editor =>
  [...findReferencesProviders].find(({ isEditorSupported }) =>
    isEditorSupported(editor)
  )

export const addDefinitions = provider => {
  definitionsProviders.add(provider)
}

export const getDefinitionsForEditor = editor =>
  getDefinitionsForScope(editor.getGrammar().scopeName)

export const getDefinitionsForScope = scope =>
  [...definitionsProviders].find(({ grammarScopes }) =>
    grammarScopes.includes(scope)
  )
