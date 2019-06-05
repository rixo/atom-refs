'use babel'

export default (
  { start: { column: ca, row: ra } },
  { start: { column: cb, row: rb } }
) => {
  if (ra < rb) {
    return -1
  } else if (ra > rb) {
    return 1
  } else {
    return ca - cb
  }
}
