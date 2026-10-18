import { withMermaid } from 'vitepress-plugin-mermaid'
import { defineConfig } from 'vitepress'
import { readdirSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishedPages } from './published-pages.mjs'

function markdownFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory() && entry.name !== '.vitepress') return markdownFiles(path, relativePath)
    return entry.isFile() && entry.name.endsWith('.md') ? [relativePath] : []
  })
}

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const sourceFiles = markdownFiles(sourceRoot).map((path) => path.split(sep).join('/'))
const missingPages = [...publishedPages].filter((path) => !sourceFiles.includes(path))
if (missingPages.length) throw new Error(`Published documentation page is missing: ${missingPages.join(', ')}`)
const srcExclude = sourceFiles.filter((path) => !publishedPages.has(path))

export default withMermaid(defineConfig({
  title: 'AgenticAle',
  description: 'Portable coding workflows with independent review.',
  lang: 'en-US',
  base: '/AgenticAle/',
  cleanUrls: false,
  mermaidPlugin: { class: 'mermaid-diagram' },
  srcExclude,
  themeConfig: {
    nav: [
      { text: 'Start here', link: '/getting-started' },
      { text: 'Skills', link: '/skills/work/' },
      { text: 'Guides', link: '/guides/model-routing' },
      { text: 'Reference', link: '/architecture' },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Start here', link: '/getting-started' },
          { text: 'Install and configure', link: '/setup' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'Runtime compatibility', link: '/runtime-compatibility' },
        ],
      },
      {
        text: 'Skills',
        items: [
          { text: 'Work', link: '/skills/work/' },
          { text: 'Autonomous', link: '/skills/autonomous/' },
          { text: 'Source code lookup', link: '/skills/source-code-lookup/' },
          { text: 'Pull request description', link: '/skills/pull-request-description/' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Model routing', link: '/guides/model-routing' },
          { text: 'Troubleshooting', link: '/guides/troubleshooting' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'Runtime compatibility', link: '/runtime-compatibility' },
          { text: 'Contributing', link: '/contributing' },
          { text: 'Site maintenance', link: '/site-maintenance' },
        ],
      },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/alefranz/AgenticAle' }],
  },
}))
