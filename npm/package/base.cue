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
	...
}

// Feature contributions - each feature defines its own, base provides defaults
ts: {} | *{}
node: {} | *{}
react: {} | *{}
cue: {} | *{}
vite: {} | *{}
viteReact: {} | *{}

// Final output: merge all contributions
output: #PackageJson & ts & node & react & cue & vite & viteReact
