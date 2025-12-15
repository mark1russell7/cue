package package

// @mark1russell7/cue package.json (dogfooding)
// Composes: _typescript & _node & project-specific
// Run: cue eval ./npm/package/*.cue -e cuePackage --out json > package.json

cuePackage: _typescript & _node & {
	$schema:     "https://json.schemastore.org/package"
	name:        "@mark1russell7/cue"
	version:     "0.0.0"
	description: "Shared CUE schemas and templates for TypeScript project configuration"
	license:     "MIT"
	author:      "Mark Russell <marktheprogrammer17@gmail.com>"
	main:        "./dist/cli.js"
	types:       "./dist/cli.d.ts"
	bin: {
		"cue-config": "./dist/cli.js"
	}
	files: ["dist", "cue.mod", "ts", "npm", "gitignore", "features.json"]
	scripts: {
		build:           "tsc -b"
		"generate:self": "cue eval ./npm/package/*.cue -e cuePackage --out json > package.json"
		prepare:         "npm run build"
	}
	keywords: ["cue", "typescript", "config", "schema", "validation", "gitignore"]
	repository: {
		type: "git"
		url:  "https://github.com/mark1russell7/cue.git"
	}
	bugs: url: "https://github.com/mark1russell7/cue/issues"
	homepage:      "https://github.com/mark1russell7/cue#readme"
	publishConfig: access: "public"
	engines: {
		node: ">=25.0.0"
		npm:  ">=11.0.0"
	}
}
