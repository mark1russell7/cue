package package

import "strings"

// Base package.json schema - open for composition

// Semantic version pattern
#SemVer: string & =~"^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?(\\+[a-zA-Z0-9.-]+)?$"

// Version range pattern (npm-style)
#VersionRange: string & =~"^(\\^|~|>=?|<=?)?\\d+(\\.\\d+)?(\\.\\d+)?(-[a-zA-Z0-9.-]+)?$|^\\*$|^latest$|^github:.+#.+$|^file:.+$|^workspace:.+$"

// Scoped or unscoped package name
#PackageName: string & =~"^(@[a-z0-9-]+/)?[a-z0-9-]+$" & strings.MinRunes(1) & strings.MaxRunes(214)

// Base PackageJson schema - all fields optional with open structs for composition
#PackageJson: {
	$schema?: string

	// Identity
	name:         #PackageName
	version:      #SemVer
	description?: string
	license?:     string
	author?:      string
	keywords?: [...string]

	// Module system
	type?: "module" | "commonjs"

	// Entry points
	main?:  string
	types?: string

	// Exports map - open for additional exports
	exports?: {
		"."?: {
			types?:   string
			import?:  string
			require?: string
			default?: string
			...
		}
		...
	}

	// Files to publish
	files?: [...string]

	// Scripts - open
	scripts?: {
		[string]: string
	}

	sideEffects?: bool

	// Dependencies - open for any package names
	devDependencies?: {
		[string]: string
	}
	dependencies?: {
		[string]: string
	}
	peerDependencies?: {
		[string]: string
	}

	// Metadata
	repository?: {
		type?: string
		url?:  string
		...
	}
	bugs?: {
		url?:   string
		email?: string
		...
	}
	homepage?: string
	publishConfig?: {
		access?:   string
		registry?: string
		...
	}
	engines?: {
		node?: string
		npm?:  string
		...
	}

	// Bin for CLI packages - open
	bin?: {
		[string]: string
	}

	// Allow any additional fields
	...
}
