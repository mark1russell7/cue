package dependencies

// Dependencies.json schema
// User declares which features their project uses

#FeatureName: "git" | "npm" | "ts" | "react" | "node" | "vite" | "vite-react" | "cue"

#Dependencies: {
	"$schema"?: string
	dependencies: [...#FeatureName]
}
