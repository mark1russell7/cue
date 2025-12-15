package package

// TypeScript feature - shared parts only
// Project-specific paths (main, types, files) set by project

_typescript: {
	type: "module"
	scripts: {
		build:     "tsc -b"
		typecheck: "tsc --noEmit"
		clean:     "rm -rf dist .tsbuildinfo"
	}
	sideEffects: false
	devDependencies: {
		typescript: "^5.9.3"
	}
}

// Standard TypeScript library defaults (for projects that want them)
_typescriptLib: _typescript & {
	main:  "./dist/index.js"
	types: "./dist/index.d.ts"
	exports: ".": {
		types:  "./dist/index.d.ts"
		import: "./dist/index.js"
	}
	files: ["dist", "src"]
}
