package config

// Vitest feature contribution
// The test script passes when a package has no test files yet, so CI can run "test" in every package.
vitest: {
	scripts: {
		test:         string | *"vitest run --passWithNoTests"
		"test:watch": string | *"vitest"
	}
	devDependencies: {
		vitest: "^4.1.11"
	}
}
