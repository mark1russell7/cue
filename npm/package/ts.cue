package package

// TypeScript-specific package.json additions

// TypeScript package extends base with ts-specific conventions
#TypeScriptPackageJson: #PackageJson & {
	type:  "module"
	main:  =~"\\./dist/.+\\.js$" | *"./dist/index.js"
	types: =~"\\./dist/.+\\.d\\.ts$" | *"./dist/index.d.ts"
	exports: ".": {
		types:  =~"\\.d\\.ts$"
		import: =~"\\.js$"
	}
	files: [...string] | *["dist", "src"]
	scripts: {
		build:      string | *"tsc -b"
		typecheck?: string | *"tsc --noEmit"
		clean?:     string | *"rm -rf dist .tsbuildinfo"
		...
	}
	sideEffects: bool | *false
	devDependencies: {
		typescript: #VersionRange
		...
	}
}
