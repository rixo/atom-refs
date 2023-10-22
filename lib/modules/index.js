/** @babel */

const modules = [
  require('./js'),
  // require('./svelte'),
  // require('./php'),
  // python not supported because tree-sitter broken with node12+ currently
  //
  // removed from package.json:
  //
  // "tree-sitter": "^0.12.8",
  // "tree-sitter-python": "^0.11.3",
  //
  // see: https://github.com/tree-sitter/node-tree-sitter/issues/46
  //
  // require('./python'),
]

const scopeModule = mapModulesByScope(modules)

const getModule = scope => scopeModule[scope]

const isSupported = scope => !!getModule(scope)

const getScopes = () => Object.keys(scopeModule)

export default {
  isSupported,
  getModule,
  getScopes,
}

function mapModulesByScope(modules) {
  const map = {}
  modules.forEach(module => {
    if (!module.scopes) {
      throw new Error('Invalid module: missing scopes')
    }
    module.scopes.forEach(scope => {
      map[scope] = module
    })
  })
  return map
}
