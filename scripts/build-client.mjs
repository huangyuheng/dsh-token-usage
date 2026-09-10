/**
 * Build the client bundle: a tree-shaken ECharts vendor script concatenated
 * with the hand-written module-loader source, so consumers install the built
 * artifact without running a bundler themselves.
 */
import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vendorOut = join(root, 'client/vendor/echarts.min.js')
await mkdir(dirname(vendorOut), { recursive: true })
await build({
  entryPoints: [join(root, 'vendor/echarts-entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  legalComments: 'none',
  outfile: vendorOut,
})
const vendor = await readFile(vendorOut, 'utf8')
const source = await readFile(join(root, 'client/src.js'), 'utf8')
const output = `${vendor}\n${source}`
await writeFile(join(root, 'client/client.js'), output)
console.log(`client/client.js written: vendor ${(vendor.length / 1024).toFixed(0)}KB + source ${(source.length / 1024).toFixed(0)}KB`)
