const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "..")

const config = getDefaultConfig(projectRoot, { isCSSEnabled: true })

config.watchFolders = [workspaceRoot, path.join(workspaceRoot, "public")]
config.resolver.assetExts.push("png", "jpg", "jpeg", "svg")

module.exports = config
