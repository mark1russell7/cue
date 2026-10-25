package config

// Node.js CommonJS feature contribution
// The package is CommonJS, so tsc (module NodeNext, node-cjs.json) emits CommonJS. The "require"
// condition lets require() load the entry point. The "import" condition of ts loads the same file.
nodeCjs: {
	type: "commonjs"
	exports: ".": require: "./dist/index.js"
}
