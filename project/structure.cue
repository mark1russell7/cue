package project

// Project structure validation schema
// Validates folder structure against ecosystem standards

#RequiredFile: {
	path:     string
	optional: bool | *false
}

#RequiredDir: {
	path:     string
	optional: bool | *false
}

#ProjectStructure: {
	// Required files for a valid project
	requiredFiles: [...#RequiredFile] | *[
		{path: "package.json"},
		{path: "tsconfig.json"},
		{path: "dependencies.json"},
		{path: ".gitignore"},
	]

	// Required directories
	requiredDirs: [...#RequiredDir] | *[
		{path: "src"},
	]

	// Optional directories (created on build)
	optionalDirs: [...#RequiredDir] | *[
		{path: "dist", optional: true},
		{path: "node_modules", optional: true},
	]
}

// Validation result for a single item
#ValidationItem: {
	path:   string
	exists: bool
	valid:  bool
}

// Overall validation result
#ValidationResult: {
	valid:    bool
	files:    [...#ValidationItem]
	dirs:     [...#ValidationItem]
	warnings: [...string]
	errors:   [...string]
}

// Default project structure (used by lib.new)
DefaultStructure: #ProjectStructure & {}
