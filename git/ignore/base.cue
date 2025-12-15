package ignore

import "list"

// Each feature defines its own list, base collects them all
base: [
	".DS_Store",
	"Thumbs.db",
	"*.swp",
	"*.swo",
	"*~",
	"*.log",
]

// Defaults for optional features (overridden when feature file is included)
npm: [...string] | *[]
ts: [...string] | *[]
cue: [...string] | *[]
react: [...string] | *[]
vite: [...string] | *[]
env: [...string] | *[]
vscode: [...string] | *[]
node: [...string] | *[]

// Final output: concatenate all
patterns: list.Concat([base, npm, ts, cue, react, vite, env, vscode, node])
