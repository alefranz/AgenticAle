#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishedPages } from '../docs/.vitepress/published-pages.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = join(repositoryRoot, 'docs', '.vitepress', 'dist')
const base = '/AgenticAle/'
const errors = []

function fail(message) {
  errors.push(message)
}

function htmlFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name)
    return entry.isDirectory()
      ? htmlFiles(absolute)
      : entry.isFile() && extname(entry.name).toLowerCase() === '.html'
        ? [absolute]
        : []
  })
}

function expectedHtmlPath(markdownPath) {
  return markdownPath.replace(/\.md$/i, '.html')
}

function collectIds(html) {
  const ids = new Set()
  for (const match of html.matchAll(/\b(?:id|name)=["']([^"']+)["']/gi)) ids.add(decodeEntities(match[1]))
  return ids
}

function decodeEntities(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>')
}

const expectedPages = new Set([...publishedPages].map(expectedHtmlPath))
const actualHtmlFiles = htmlFiles(outputRoot)
const actualPages = new Set(actualHtmlFiles
  .map((file) => relative(outputRoot, file).split(sep).join('/'))
  .filter((path) => path !== '404.html'))

if (!existsSync(outputRoot) || !statSync(outputRoot).isDirectory()) {
  fail(`Build output not found: ${outputRoot}; run npm run docs:build first`)
} else {
  for (const page of expectedPages) if (!actualPages.has(page)) fail(`Expected published page is missing: ${page}`)
  for (const page of actualPages) if (!expectedPages.has(page)) fail(`Unexpected HTML page was generated: ${page}`)
}

const idsByPage = new Map()
const checkedCss = new Set()
for (const file of actualHtmlFiles) {
  const page = relative(outputRoot, file).split(sep).join('/')
  const html = readFileSync(file, 'utf8')
  const ids = collectIds(html)
  idsByPage.set(page, ids)
  const publicPath = `${base}${page === 'index.html' ? '' : page}`
  const hrefs = [...html.matchAll(/\b(?:href|src|poster)=["']([^"']+)["']/gi)].map((match) => decodeEntities(match[1]))

  for (const href of hrefs) {
    if (!href || href.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(href)) continue
    if (href.startsWith('/') && !href.startsWith(base)) {
      fail(`${page}: root-relative URL does not use the configured base ${base}: ${href}`)
      continue
    }
    let targetUrl
    try {
      targetUrl = new URL(href, `https://docs.invalid${publicPath}`)
    } catch {
      fail(`${page}: invalid URL: ${href}`)
      continue
    }
    if (targetUrl.origin !== 'https://docs.invalid') continue
    if (!targetUrl.pathname.startsWith(base)) {
      fail(`${page}: local URL escapes the configured base ${base}: ${href}`)
      continue
    }
    let targetPath = decodeURIComponent(targetUrl.pathname.slice(base.length))
    if (!targetPath) targetPath = 'index.html'
    if (targetPath.endsWith('/')) targetPath += 'index.html'
    let targetFile = join(outputRoot, targetPath)
    if (!existsSync(targetFile) && !extname(targetPath)) {
      const htmlTarget = `${targetPath}.html`
      if (existsSync(join(outputRoot, htmlTarget))) {
        targetPath = htmlTarget
        targetFile = join(outputRoot, targetPath)
      } else {
        targetPath = join(targetPath, 'index.html').split(sep).join('/')
        targetFile = join(outputRoot, targetPath)
      }
    }
    if (!existsSync(targetFile) || !statSync(targetFile).isFile()) {
      fail(`${page}: local target does not exist: ${href}`)
      continue
    }
    if (targetUrl.hash) {
      const targetRelative = relative(outputRoot, targetFile).split(sep).join('/')
      const targetIds = idsByPage.get(targetRelative) ?? collectIds(readFileSync(targetFile, 'utf8'))
      const fragment = decodeURIComponent(targetUrl.hash.slice(1))
      if (!targetIds.has(fragment)) fail(`${page}: fragment #${fragment} does not exist in ${targetRelative}`)
    }
  }
}

for (const file of actualHtmlFiles) {
  const page = relative(outputRoot, file).split(sep).join('/')
  const html = readFileSync(file, 'utf8')
  for (const match of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi)) {
    const cssUrl = decodeEntities(match[1])
    const cssPath = decodeURIComponent(new URL(cssUrl, `https://docs.invalid${base}${page}`).pathname.slice(base.length))
    const cssFile = join(outputRoot, cssPath)
    if (!existsSync(cssFile) || checkedCss.has(cssFile)) continue
    checkedCss.add(cssFile)
    const css = readFileSync(cssFile, 'utf8')
    for (const asset of css.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) {
      const value = asset[1].trim()
      if (!value || value.startsWith('data:') || value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)) continue
      let assetFile
      if (value.startsWith('/')) {
        if (!value.startsWith(base)) {
          fail(`${relative(outputRoot, cssFile).split(sep).join('/')}: root-relative CSS asset does not use ${base}: ${value}`)
          continue
        }
        assetFile = join(outputRoot, decodeURIComponent(value.slice(base.length).split(/[?#]/, 1)[0]))
      } else {
        assetFile = resolve(dirname(cssFile), decodeURIComponent(value.split(/[?#]/, 1)[0]))
      }
      if (!existsSync(assetFile)) fail(`${relative(outputRoot, cssFile).split(sep).join('/')}: CSS asset does not exist: ${value}`)
    }
  }
}

if (errors.length) {
  console.error(`Documentation check failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Documentation check passed: ${expectedPages.size} published pages, local links/fragments/assets, and base ${base}.`)
}
