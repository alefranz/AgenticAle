#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = join(repositoryRoot, 'presentation')
const outputRoot = join(repositoryRoot, 'docs', '.vitepress', 'dist')
const files = ['index.html', 'speaker.html']

function fail(message) {
  console.error(`Presentation copy failed: ${message}`)
  process.exit(1)
}

if (!existsSync(outputRoot)) {
  fail(`Build output not found: ${outputRoot}; run npm run docs:build first`)
}

for (const file of files) {
  const source = join(sourceRoot, file)
  if (!existsSync(source)) fail(`Source file is missing: ${relative(repositoryRoot, source)}`)
  const target = join(outputRoot, 'presentation', file)
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
  console.log(`Copied ${relative(repositoryRoot, source)} to ${relative(repositoryRoot, target)}`)
}
