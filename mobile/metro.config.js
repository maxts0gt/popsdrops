import path from "path";
import { getDefaultConfig } from "expo/metro-config";
import { withNativeWind } from "nativewind/metro";

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, "../shared");

const config = getDefaultConfig(projectRoot);

// Watch the shared directory for changes
config.watchFolders = [sharedRoot];

// Resolve modules from both the project and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(projectRoot, "..", "node_modules"),
];

export default withNativeWind(config, { input: "./global.css" });
