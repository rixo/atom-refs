'use babel'

const modules = [
  require('./js'),
  require('./php'),
]

const scopeModule = mapModulesByScope(modules)

const getModule = scope => scopeModule[scope]

const isSupported = scope => !!getModule(scope)

export default {
  isSupported,
  getModule,
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
