const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// T7 / macOS AppleDouble (._*) — Finder újraírja; ne kerüljön bundle / route discovery-be
const appleDouble = [/\/\._[^/]*$/, /\/\.__[^/]*$/]
const existing = config.resolver.blockList
if (Array.isArray(existing)) {
  config.resolver.blockList = [...existing, ...appleDouble]
} else if (existing) {
  config.resolver.blockList = [existing, ...appleDouble]
} else {
  config.resolver.blockList = appleDouble
}

module.exports = config
