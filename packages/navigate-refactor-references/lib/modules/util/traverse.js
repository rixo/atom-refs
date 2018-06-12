'use babel'

export const STOP = Symbol('stop')
export const SKIP = Symbol('skip')

export function down(root, handler) {
  const typeKey = 'type'
  const childrenKey = 'children'
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
  root.children.some(visit)
  return result
}

export function up(node, handler) {
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
