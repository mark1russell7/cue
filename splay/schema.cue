// Splay Adapters Schema
//
// Defines the structure of adapters.json files.
// Maps framework names to their splay adapter package locations.

package splay

// Adapters registry structure
#Adapters: {
	// Map of framework name to adapter package location
	[#FrameworkName]: #PackageRef
}

// Framework name: lowercase alphanumeric (react, vue, svelte, solid, etc.)
#FrameworkName: =~"^[a-z][a-z0-9-]*$"

// Package reference: GitHub reference or npm package
#PackageRef: string & (
	// GitHub reference: github:owner/repo#ref
	=~"^github:[a-zA-Z0-9-]+/[a-zA-Z0-9-]+#[a-zA-Z0-9-]+$" |
	// npm package: @scope/name or name
	=~"^(@[a-z0-9-]+/)?[a-z0-9-]+$"
)

// Validation example
_example: #Adapters & {
	react:  "github:mark1russell7/splay-react#main"
	vue:    "github:mark1russell7/splay-vue#main"
	svelte: "@mark1russell7/splay-svelte"
}
