package ecosystem

// Ecosystem manifest schema
// Defines all packages in the @mark1russell7 ecosystem

#PackageEntry: {
	repo:    string & =~"^github:[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+#[a-zA-Z0-9_-]+$"
	path:    string
	branch?: string
}

#ProjectTemplate: {
	files: [...string]
	dirs: [...string]
}

#EcosystemManifest: {
	"$schema"?: string
	version:    string & =~"^[0-9]+\\.[0-9]+\\.[0-9]+$"
	root:       string
	packages: {
		[string & =~"^@mark1russell7/"]: #PackageEntry
	}
	projectTemplate: #ProjectTemplate
}
