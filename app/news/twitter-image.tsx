// The same Wire card as opengraph-image.tsx, for X's summary_large_image.
import Image from './opengraph-image'

// Edge: the node build of next/og cannot find its bundled font on Windows
// in dev (a file-URL bug in Next 14), and the edge build is the documented default.
export const runtime = 'edge'
export const alt = 'The Wire on EdTheStatMan.com: injuries, line moves and game previews'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default Image
