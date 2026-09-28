import fs from 'node:fs'
import wordListPath from 'word-list'
const words = fs.readFileSync(wordListPath, 'utf8').split('\n').filter(word => /^[a-z]{5}$/.test(word))
fs.writeFileSync('convex/wordList.ts', '// Generated from word-list (MIT). See assets/word-list-LICENSE.txt.\n// Regenerate with node scripts/generate-word-list.mjs\nexport const validWords = new Set(' + JSON.stringify(words.join(' ')) + '.split(" "))\n')
