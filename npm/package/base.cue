package config

import "strings"

// Semantic version pattern
#SemVer: string & =~"^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?(\\+[a-zA-Z0-9.-]+)?$"

// Scoped or unscoped package name
#PackageName: string & =~"^(@[a-z0-9-]+/)?[a-z0-9-]+$" & strings.MinRunes(1) & strings.MaxRunes(214)

// PackageJson schema
#PackageJson: {
	"$schema"?: string
	name:       #PackageName | *"unnamed"
	version:    #SemVer | *"0.0.0"
	description?: string
	license?: string
	author?: string
	keywords?: [...string]
	type?: "module" | "commonjs"
	main?: string
	types?: string
	exports?: _
	files?: [...string]
	scripts?: [string]: string
	sideEffects?: bool
	devDependencies?: [string]: string
	dependencies?: [string]: string
	peerDependencies?: [string]: string
	repository?: _
	bugs?: _
	homepage?: string
	publishConfig?: _
	engines?: _
	bin?: [string]: string
	pnpm?: #PnpmConfig
	...
}

// Pnpm configuration
#PnpmConfig: {
	// Packages allowed to run install scripts (required for GitHub deps that need build)
	onlyBuiltDependencies?: [...string]
	// Override specific package versions
	overrides?: [string]: string
	// Peer dependency settings
	peerDependencyRules?: {
		ignoreMissing?: [...string]
		allowAny?: [...string]
	}
	...
}

// Feature contributions - each feature defines its own, base provides defaults
ts: {} | *{}
node: {} | *{}
react: {} | *{}
cue: {} | *{}
vite: {} | *{}
viteReact: {} | *{}

// Collect all @mark1russell7/* dependencies for onlyBuiltDependencies
_allDeps: {
	for name, _ in output.dependencies if strings.HasPrefix(name, "@mark1russell7/") {
		(name): true
	}
	for name, _ in output.devDependencies if strings.HasPrefix(name, "@mark1russell7/") {
		(name): true
	}
}
_mark1russell7DepsList: [ for name, _ in _allDeps {name}]

// Final output: merge all contributions + auto-populate onlyBuiltDependencies
output: #PackageJson & ts & node & react & cue & vite & viteReact & {
	if len(_mark1russell7DepsList) > 0 {
		pnpm: onlyBuiltDependencies: _mark1russell7DepsList
	}
}
