'use babel'

export const STOP = Symbol('stop')
export const SKIP = Symbol('skip')

const typeKey = 'type'
const childrenKey = 'children'

const createSelector = type => node => {
  if (node.type === type) {
    return node
  }
}

export function down(root, handler) {
  if (typeof handler === 'string') {
    handler = createSelector(handler)
  }
  let done = false
  let result = void 0
  const visit = node => {
    if (done) {
      return
    }
    if (!node || typeof node[typeKey] !== 'string') {
      return
    }
    const goon = handler ? handler(node) : void 0
    if (goon !== undefined) {
      if (goon === STOP) {
        done = true
        return
      } else if (goon !== SKIP) {
        result = goon
        done = true
        return
      }
    } else {
      const children = node[childrenKey]
      if (children && children.length > 0) {
        children.some(visit)
      }
    }
    return done
  }
  // visit(root)
  root[childrenKey].some(visit)
  return result
}

export function up(node, handler) {
  if (typeof handler === 'string') {
    handler = createSelector(handler)
  }
  let cursor = node.parent
  while (cursor) {
    const result = handler(cursor)
    if (result !== undefined) {
      return result
    }
    cursor = cursor.parent
  }
  return void 0
}
