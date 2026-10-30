package config

// Vitest feature contribution
// The test script passes when a package has no test files yet, so CI can run "test" in every package.
// The test feature (test.cue) sets "vitest run". Then a package without test files fails.
_vitestTest: string | *"vitest run --passWithNoTests"

vitest: {
	scripts: {
		test:         string | *_vitestTest
		"test:watch": string | *"vitest"
	}
	devDependencies: {
		vitest: "^5.0.3"
	}
}
