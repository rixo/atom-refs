'use babel'

// custom Map interface with support for invalidate and item.dispose
export default function Data() {
  const map = new Map()

  const get = path => map.get(path)

  const set = (path, item) => {
    deleteItem(path) // ensure proper disposale of existing item
    map.set(path, item)
  }

  const has = path => map.has(path)

  const replace = (owner, path, createItem) => {
    const previousItem = map.get(path)
    if (previousItem && previousItem.owner === owner) {
      return
    }
    set(path, createItem())
  }

  const deleteItem = path => {
    const item = map.get(path)
    if (item) {
      if (item.dispose) {
        item.dipose()
      }
      map.delete(path)
    }
  }

  // invalidation from any source is accepted (in case of multiple concurrent
  // sources -- editors and/or files). I mean... they saw something that our
  // source didn't... not worth risking to be outdated just to save a reparse
  const invalidate = path => {
    const item = map.get(path)
    if (item) {
      item.invalidate()
    }
  }

  return Object.assign(this || {}, {
    get,
    set,
    has,
    replace,
    delete: deleteItem,
    invalidate,
  })
}
