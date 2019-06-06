'use babel'

import { get as getForPath } from '../cache'

export const getCached = editor => getForPath(editor.getPath()).getJumpContext()
