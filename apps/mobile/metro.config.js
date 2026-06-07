// Monorepo: watch workspace roots + resolve hoisted deps (Expo docs — Monorepos).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

/** Workspace TS packages use NodeNext `.js` import specifiers; Metro resolves them to `.ts`. */
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@enagar/forms/upload') {
    return context.resolveRequest(
      context,
      path.resolve(workspaceRoot, 'packages/forms/src/application-document-upload.ts'),
      platform,
    );
  }

  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    !moduleName.includes('node_modules')
  ) {
    const tsName = `${moduleName.slice(0, -3)}.ts`;
    try {
      return context.resolveRequest(context, tsName, platform);
    } catch {
      /* fall through */
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
