const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// pnpm legt Pakete als Symlinks in node_modules ab – Metro muss das explizit
// unterstützen, sonst schlagen Imports aus workspace-Paketen (z.B. @papaerless/shared-types) fehl.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
