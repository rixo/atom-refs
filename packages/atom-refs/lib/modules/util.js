'use babel'

export const lazy = createParser => {
  let parse = (...args) => {
    parse = createParser()
    return parse(...args)
  }
  return (...args) => parse(...args)
}
