package dependencies

// Dependencies.json schema - just a list of features
// Project metadata comes from project.json or git/folder inference

#FeatureName: "git" | "npm" | "ts" | "react" | "node" | "vite" | "vite-react" | "cue"

#Dependencies: [...#FeatureName]
