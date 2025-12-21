package features

// Features.json schema
// Defines available features, their dependencies, and presets

#FeatureName: "git" | "npm" | "ts" | "react" | "node" | "vite" | "vite-react" | "cue" | "node-cjs"

#Feature: {
	dependencies: [...#FeatureName]
}

#Features: {
	"$schema"?: string
	features: {
		[#FeatureName]: #Feature
	}
	presets: {
		[string]: [...#FeatureName]
	}
}
