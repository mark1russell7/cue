#!/usr/bin/env node
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_child_process_1 = require("node:child_process");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
// Constants
var __dirname = (0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(import.meta.url));
var packageRoot = (0, node_path_1.resolve)(__dirname, '..');
// Tsconfig priority: later features override earlier (most specific wins)
var TSCONFIG_PRIORITY = ['ts', 'node', 'vite', 'react'];
// ============================================================================
// Core Functions
// ============================================================================
function loadFeatures() {
    var featuresPath = (0, node_path_1.resolve)(packageRoot, 'features.json');
    if (!(0, node_fs_1.existsSync)(featuresPath)) {
        console.error('Error: features.json not found in package');
        process.exit(1);
    }
    return JSON.parse((0, node_fs_1.readFileSync)(featuresPath, 'utf-8'));
}
function loadDependencies(projectPath) {
    if (projectPath === void 0) { projectPath = '.'; }
    var depsPath = (0, node_path_1.resolve)(projectPath, 'dependencies.json');
    if (!(0, node_fs_1.existsSync)(depsPath)) {
        return null;
    }
    var content = JSON.parse((0, node_fs_1.readFileSync)(depsPath, 'utf-8'));
    if (Array.isArray(content)) {
        return content;
    }
    if (content.dependencies && Array.isArray(content.dependencies)) {
        return content.dependencies;
    }
    console.error('dependencies.json must have a "dependencies" array');
    process.exit(1);
}
function saveDependencies(deps, projectPath) {
    if (projectPath === void 0) { projectPath = '.'; }
    var depsJson = {
        $schema: './node_modules/@mark1russell7/cue/dependencies/schema.json',
        dependencies: deps,
    };
    (0, node_fs_1.writeFileSync)((0, node_path_1.resolve)(projectPath, 'dependencies.json'), JSON.stringify(depsJson, null, 2) + '\n');
}
function loadPackageJson(projectPath) {
    if (projectPath === void 0) { projectPath = '.'; }
    var pkgPath = (0, node_path_1.resolve)(projectPath, 'package.json');
    if (!(0, node_fs_1.existsSync)(pkgPath)) {
        return null;
    }
    return JSON.parse((0, node_fs_1.readFileSync)(pkgPath, 'utf-8'));
}
// Flood-fill resolve all transitive dependencies
function resolveFeatures(requested, manifest) {
    var resolved = new Set();
    var queue = __spreadArray([], requested, true);
    while (queue.length > 0) {
        var feature = queue.shift();
        if (resolved.has(feature))
            continue;
        var featureDef = manifest.features[feature];
        if (!featureDef) {
            console.error("Warning: Unknown feature '".concat(feature, "'"));
            continue;
        }
        resolved.add(feature);
        for (var _i = 0, _a = featureDef.dependencies; _i < _a.length; _i++) {
            var dep = _a[_i];
            if (!resolved.has(dep)) {
                queue.push(dep);
            }
        }
    }
    return Array.from(resolved);
}
// Map feature name to CUE file field name (handle vite-react -> viteReact)
function featureToFieldName(feature) {
    if (feature === 'vite-react')
        return 'viteReact';
    return feature;
}
// ============================================================================
// CUE Evaluation
// ============================================================================
function checkCue() {
    try {
        (0, node_child_process_1.execSync)('cue version', { stdio: 'ignore' });
        return true;
    }
    catch (_a) {
        console.error('Error: CUE is not installed.');
        console.error('Install from: https://cuelang.org/docs/install/');
        return false;
    }
}
function generatePackageJson(resolvedFeatures, existingPkg, _projectPath) {
    var _a;
    if (_projectPath === void 0) { _projectPath = '.'; }
    var configDir = (0, node_path_1.resolve)(packageRoot, 'npm/package');
    // Build list of CUE files to evaluate
    var files = ['base.cue'];
    for (var _i = 0, resolvedFeatures_1 = resolvedFeatures; _i < resolvedFeatures_1.length; _i++) {
        var feature = resolvedFeatures_1[_i];
        var fieldName = featureToFieldName(feature);
        var cuePath = (0, node_path_1.resolve)(configDir, "".concat(fieldName, ".cue"));
        if ((0, node_fs_1.existsSync)(cuePath)) {
            files.push("".concat(fieldName, ".cue"));
        }
    }
    // Run cue eval
    var result = (0, node_child_process_1.spawnSync)('cue', __spreadArray(__spreadArray(['eval'], files, true), ['-e', 'output', '--out', 'json'], false), {
        cwd: configDir,
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
        console.error('CUE evaluation failed for package.json:');
        console.error(result.stderr);
        process.exit(1);
    }
    var generated = JSON.parse(result.stdout);
    // Merge with existing package.json
    var pkg = __assign({}, existingPkg);
    // Apply generated values (existing values take precedence for some fields)
    for (var _b = 0, _c = Object.entries(generated); _b < _c.length; _b++) {
        var _d = _c[_b], key = _d[0], value = _d[1];
        if (key === 'name' || key === 'version' || key === 'description') {
            // Keep existing if present
            if (!pkg[key])
                pkg[key] = value;
        }
        else if (key === 'devDependencies' || key === 'peerDependencies' || key === 'scripts') {
            // Merge objects
            pkg[key] = __assign(__assign({}, value), ((_a = pkg[key]) !== null && _a !== void 0 ? _a : {}));
        }
        else if (key === 'files' && Array.isArray(value) && Array.isArray(pkg[key])) {
            // Merge arrays (deduplicated, generated first then existing)
            var merged = __spreadArray([], value, true);
            for (var _e = 0, _f = pkg[key]; _e < _f.length; _e++) {
                var item = _f[_e];
                if (!merged.includes(item))
                    merged.push(item);
            }
            pkg[key] = merged;
        }
        else {
            // Generated values take precedence for other fields
            pkg[key] = value;
        }
    }
    // Ensure $schema is first
    var ordered = { $schema: 'https://json.schemastore.org/package' };
    for (var _g = 0, _h = Object.entries(pkg); _g < _h.length; _g++) {
        var _j = _h[_g], key = _j[0], value = _j[1];
        if (key !== '$schema')
            ordered[key] = value;
    }
    return ordered;
}
function generateGitignore(resolvedFeatures) {
    var configDir = (0, node_path_1.resolve)(packageRoot, 'git/ignore');
    // Build list of CUE files to evaluate
    var files = ['base.cue'];
    for (var _i = 0, resolvedFeatures_2 = resolvedFeatures; _i < resolvedFeatures_2.length; _i++) {
        var feature = resolvedFeatures_2[_i];
        var cuePath = (0, node_path_1.resolve)(configDir, "".concat(feature, ".cue"));
        if ((0, node_fs_1.existsSync)(cuePath)) {
            files.push("".concat(feature, ".cue"));
        }
    }
    // Run cue eval
    var result = (0, node_child_process_1.spawnSync)('cue', __spreadArray(__spreadArray(['eval'], files, true), ['-e', 'patterns', '--out', 'json'], false), {
        cwd: configDir,
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
        console.error('CUE evaluation failed for .gitignore:');
        console.error(result.stderr);
        process.exit(1);
    }
    var patterns = JSON.parse(result.stdout);
    return patterns.join('\n') + '\n';
}
function determineTsconfig(resolvedFeatures) {
    // Find the most specific tsconfig (highest priority feature wins)
    var selected = 'ts'; // default
    for (var _i = 0, TSCONFIG_PRIORITY_1 = TSCONFIG_PRIORITY; _i < TSCONFIG_PRIORITY_1.length; _i++) {
        var feature = TSCONFIG_PRIORITY_1[_i];
        if (resolvedFeatures.includes(feature)) {
            selected = feature;
        }
    }
    return selected;
}
// ============================================================================
// Commands
// ============================================================================
function usage() {
    console.log("Usage: cue-config <command> [options]\n\nCommands:\n  init [--preset NAME]     Initialize dependencies.json\n  add <feature>            Add a feature to dependencies.json\n  remove <feature>         Remove a feature from dependencies.json\n  generate                 Generate package.json, tsconfig.json, .gitignore\n  validate                 Validate dependencies.json\n\nPresets: lib, react-lib, app\nFeatures: git, npm, ts, node, react, vite, vite-react, cue\n\nExamples:\n  cue-config init                        # Initialize with default 'lib' preset\n  cue-config init --preset react-lib     # Initialize React library\n  cue-config add node                    # Add node feature\n  cue-config remove vite                 # Remove vite feature\n  cue-config generate                    # Generate all configs\n");
}
function parseArgs(args, flagsWithValues) {
    if (flagsWithValues === void 0) { flagsWithValues = []; }
    var result = { _: [] };
    for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        if (arg === null || arg === void 0 ? void 0 : arg.startsWith('--')) {
            var flag = arg.slice(2);
            var nextArg = args[i + 1];
            if (flagsWithValues.includes(flag) && nextArg && !nextArg.startsWith('--')) {
                result[flag] = nextArg;
                i++;
            }
            else {
                result[flag] = true;
            }
        }
        else if (arg) {
            result._.push(arg);
        }
    }
    return result;
}
function init(args) {
    var manifest = loadFeatures();
    var parsed = parseArgs(args, ['preset']);
    var presetName = typeof parsed['preset'] === 'string' ? parsed['preset'] : 'lib';
    var preset = manifest.presets[presetName];
    if (!preset) {
        console.error("Unknown preset: ".concat(presetName));
        console.error("Available presets: ".concat(Object.keys(manifest.presets).join(', ')));
        process.exit(1);
    }
    if ((0, node_fs_1.existsSync)('dependencies.json') && !parsed['force']) {
        console.log('dependencies.json already exists (use --force to overwrite)');
    }
    else {
        saveDependencies(preset);
        console.log("Created dependencies.json with preset '".concat(presetName, "'"));
    }
    if (!(0, node_fs_1.existsSync)('src')) {
        (0, node_fs_1.mkdirSync)('src', { recursive: true });
    }
    if (!(0, node_fs_1.existsSync)('src/index.ts')) {
        (0, node_fs_1.writeFileSync)('src/index.ts', '// Entry point\nexport {};\n');
        console.log('Created src/index.ts');
    }
    console.log("\nNext steps:\n  1. Run: npx cue-config generate\n  2. Run: npm install\n");
}
function add(args) {
    var _a;
    var feature = args[0];
    if (!feature) {
        console.error('Usage: cue-config add <feature>');
        process.exit(1);
    }
    var manifest = loadFeatures();
    if (!manifest.features[feature]) {
        console.error("Unknown feature: ".concat(feature));
        console.error("Available: ".concat(Object.keys(manifest.features).join(', ')));
        process.exit(1);
    }
    var deps = (_a = loadDependencies()) !== null && _a !== void 0 ? _a : [];
    if (deps.includes(feature)) {
        console.log("Feature '".concat(feature, "' is already in dependencies"));
        return;
    }
    deps.push(feature);
    saveDependencies(deps);
    console.log("Added '".concat(feature, "' to dependencies.json"));
}
function remove(args) {
    var feature = args[0];
    if (!feature) {
        console.error('Usage: cue-config remove <feature>');
        process.exit(1);
    }
    var deps = loadDependencies();
    if (!deps) {
        console.error('No dependencies.json found');
        process.exit(1);
    }
    var idx = deps.indexOf(feature);
    if (idx === -1) {
        console.log("Feature '".concat(feature, "' is not in dependencies"));
        return;
    }
    deps.splice(idx, 1);
    saveDependencies(deps);
    console.log("Removed '".concat(feature, "' from dependencies.json"));
}
function generate() {
    if (!checkCue())
        process.exit(1);
    var manifest = loadFeatures();
    var deps = loadDependencies();
    if (!deps) {
        console.error('No dependencies.json found. Run: npx cue-config init');
        process.exit(1);
    }
    var resolvedFeatures = resolveFeatures(deps, manifest);
    console.log("Resolved features: ".concat(resolvedFeatures.join(', ')));
    var existingPkg = loadPackageJson();
    // Generate package.json via CUE
    var packageJson = generatePackageJson(resolvedFeatures, existingPkg);
    (0, node_fs_1.writeFileSync)('package.json', JSON.stringify(packageJson, null, 2) + '\n');
    console.log('Generated package.json');
    // Generate tsconfig.json
    if (resolvedFeatures.includes('ts')) {
        var tsconfigName = determineTsconfig(resolvedFeatures);
        var tsconfig = {
            $schema: 'https://json.schemastore.org/tsconfig',
            extends: "@mark1russell7/cue/ts/config/".concat(tsconfigName, ".json"),
        };
        (0, node_fs_1.writeFileSync)('tsconfig.json', JSON.stringify(tsconfig, null, 2) + '\n');
        console.log("Generated tsconfig.json (extends ".concat(tsconfigName, ".json)"));
    }
    // Generate .gitignore via CUE
    var gitignoreContent = generateGitignore(resolvedFeatures);
    (0, node_fs_1.writeFileSync)('.gitignore', gitignoreContent);
    console.log('Generated .gitignore');
    // Setup CUE module if cue feature is present
    if (resolvedFeatures.includes('cue')) {
        setupCueMod();
        console.log('Setup cue.mod/');
    }
}
function validate() {
    var _a;
    var deps = loadDependencies();
    if (!deps) {
        console.error('No dependencies.json found. Run: npx cue-config init');
        process.exit(1);
    }
    var manifest = loadFeatures();
    for (var _i = 0, deps_1 = deps; _i < deps_1.length; _i++) {
        var feature = deps_1[_i];
        if (!manifest.features[feature]) {
            console.error("Error: Unknown feature '".concat(feature, "'"));
            process.exit(1);
        }
    }
    if (checkCue()) {
        var schemaPath = (0, node_path_1.resolve)(packageRoot, 'dependencies/schema.cue');
        if ((0, node_fs_1.existsSync)(schemaPath)) {
            var result = (0, node_child_process_1.spawnSync)('cue', ['vet', '-d', '#Dependencies', schemaPath, 'dependencies.json'], {
                stdio: 'inherit',
            });
            if (result.status !== 0) {
                process.exit((_a = result.status) !== null && _a !== void 0 ? _a : 1);
            }
        }
    }
    console.log('Validation passed');
}
function setupCueMod() {
    if (!(0, node_fs_1.existsSync)('cue.mod')) {
        (0, node_fs_1.mkdirSync)('cue.mod', { recursive: true });
    }
    (0, node_fs_1.writeFileSync)('cue.mod/module.cue', "module: \"project.local\"\nlanguage: {\n\tversion: \"v0.15.1\"\n}\n");
    var pkgDir = 'cue.mod/pkg/mark1russell7.cue';
    if (!(0, node_fs_1.existsSync)(pkgDir)) {
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(pkgDir), { recursive: true });
        try {
            if (process.platform === 'win32') {
                (0, node_child_process_1.execSync)("mklink /J \"".concat(pkgDir, "\" \"").concat(packageRoot, "\""), { stdio: 'ignore', shell: 'cmd.exe' });
            }
            else {
                (0, node_child_process_1.execSync)("ln -s \"".concat(packageRoot, "\" \"").concat(pkgDir, "\""), { stdio: 'ignore' });
            }
        }
        catch (_a) {
            (0, node_fs_1.mkdirSync)(pkgDir, { recursive: true });
            (0, node_child_process_1.execSync)("cp -r \"".concat(packageRoot, "/ts\" \"").concat(pkgDir, "/\""), { stdio: 'ignore' });
            (0, node_child_process_1.execSync)("cp -r \"".concat(packageRoot, "/npm\" \"").concat(pkgDir, "/\""), { stdio: 'ignore' });
            (0, node_child_process_1.execSync)("cp -r \"".concat(packageRoot, "/git\" \"").concat(pkgDir, "/\""), { stdio: 'ignore' });
        }
    }
}
// Self-generate for dogfooding
function selfGenerate() {
    if (!checkCue())
        process.exit(1);
    var manifest = loadFeatures();
    var deps = loadDependencies(packageRoot);
    if (!deps) {
        console.error('No dependencies.json found in package root');
        process.exit(1);
    }
    var resolvedFeatures = resolveFeatures(deps, manifest);
    console.log("Self-generate: resolved features: ".concat(resolvedFeatures.join(', ')));
    var existingPkg = loadPackageJson(packageRoot);
    var packageJson = generatePackageJson(resolvedFeatures, existingPkg, packageRoot);
    var outputPath = (0, node_path_1.resolve)(packageRoot, 'package.json');
    (0, node_fs_1.writeFileSync)(outputPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log("Generated ".concat(outputPath));
}
// ============================================================================
// Main
// ============================================================================
var args = process.argv.slice(2);
var command = args[0];
switch (command) {
    case 'init':
        init(args.slice(1));
        break;
    case 'add':
        add(args.slice(1));
        break;
    case 'remove':
        remove(args.slice(1));
        break;
    case 'generate':
        generate();
        break;
    case 'validate':
        validate();
        break;
    case 'self-generate':
        selfGenerate();
        break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
        usage();
        break;
    default:
        console.error("Unknown command: ".concat(command));
        usage();
        process.exit(1);
}
