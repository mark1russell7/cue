package config

// Test feature contribution (opt-in). "typecheck" also type-checks the tests with tsconfig.test.json.
// generate writes tsconfig.test.json: it extends tsconfig.json and ts/config/test.json.
test: {
	scripts: {
		typecheck: "tsc --noEmit && tsc -p tsconfig.test.json"
	}
}

// The test script of vitest (vitest.cue) has no --passWithNoTests: a package without test files fails.
_vitestTest: "vitest run"
