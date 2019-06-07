/** @babel */

const modules = [
  require('./js'),
  require('./svelte'),
  require('./php'),
  require('./python'),
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
