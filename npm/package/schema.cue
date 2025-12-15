package package

import "strings"

// Base package.json schema (npm-agnostic where possible)

// Semantic version pattern
#SemVer: string & =~"^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?(\\+[a-zA-Z0-9.-]+)?$"

// Version range pattern (npm-style)
#VersionRange: string & =~"^(\\^|~|>=?|<=?)?\\d+(\\.\\d+)?(\\.\\d+)?(-[a-zA-Z0-9.-]+)?$|^\\*$|^latest$|^github:.+#.+$|^file:.+$|^workspace:.+$"

// Scoped or unscoped package name
#PackageName: string & =~"^(@[a-z0-9-]+/)?[a-z0-9-]+$" & strings.MinRunes(1) & strings.MaxRunes(214)

// URL patterns
#HttpsUrl: string
#GitUrl:   string

// File path patterns
#RelativePath: string
#DistPath:     string

// Base PackageJson schema
#PackageJson: {
	$schema?: string

	// Identity
	name:         #PackageName
	version:      #SemVer
	description?: string & strings.MinRunes(1) & strings.MaxRunes(280)
	license?:     string
	author?:      string | #Author
	keywords?: [...string & strings.MinRunes(1) & strings.MaxRunes(50)]

	// Module system
	type?: "module" | "commonjs"

	// Entry points
	main?:  string
	types?: string

	// Exports map
	exports?: {
		".": #ExportConditions
		[=~"^\\./.+"]: #ExportConditions | string
	}

	// Files to publish
	files?: [...string] & [_, ...] // at least one entry

	// Scripts
	scripts?: {
		[string]: string & strings.MinRunes(1)
	}

	sideEffects?: bool

	// Dependencies
	devDependencies?:  #Dependencies
	dependencies?:     #Dependencies
	peerDependencies?: #Dependencies

	// Metadata
	repository?:    #Repository
	bugs?:          #Bugs
	homepage?:      string
	publishConfig?: #PublishConfig
	engines?:       #Engines

	// Bin for CLI packages
	bin?: {
		[string]: string & strings.MinRunes(1)
	}
}

#Author: {
	name:   string & strings.MinRunes(1)
	email?: string & =~"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
	url?:   string
}

#ExportConditions: {
	types?:   string
	import?:  string
	require?: string
	default?: string
}

#Dependencies: {
	[#PackageName]: #VersionRange
}

#Repository: {
	type?: "git" | "hg" | "svn"
	url?:  string
}

#Bugs: {
	url?:   string
	email?: string & =~"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
}

#PublishConfig: {
	access?:   "public" | "restricted"
	registry?: string
}

#Engines: {
	node?: string
	npm?:  string
}
