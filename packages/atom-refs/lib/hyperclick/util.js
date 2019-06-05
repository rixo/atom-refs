'use babel'

export const requireJSH = path =>
  require(atom.packages.resolvePackagePath('js-hyperclick') + path)
