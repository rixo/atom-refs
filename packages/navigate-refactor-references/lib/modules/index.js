'use babel'

const modules = [
  require('./js'),
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
    module.scopes.forEach(scope => {
      map[scope] = module
    })
  })
  return map
}
