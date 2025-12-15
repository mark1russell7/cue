package config

// TypeScript feature contribution
ts: {
	type: "module"
	main: "./dist/index.js"
	types: "./dist/index.d.ts"
	exports: ".": {
		types: "./dist/index.d.ts"
		import: "./dist/index.js"
	}
	files: ["dist", "src"]
	sideEffects: false
	scripts: {
		build: "tsc -b"
		typecheck: "tsc --noEmit"
		clean: "rm -rf dist .tsbuildinfo"
	}
	devDependencies: {
		typescript: "^5.9.3"
	}
}
