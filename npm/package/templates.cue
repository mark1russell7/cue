package package

// Package templates

// Standard TypeScript library template
#TSLibTemplate: {
	_name:      string
	_scope:     string | *"@mark1russell7"
	_fullName:  "\(_scope)/\(_name)"
	_shortName: _name

	output: #TypeScriptPackageJson & {
		$schema:     "https://json.schemastore.org/package"
		name:        _fullName
		version:     string | *"0.0.0"
		description: string | *"Package description"
		license:     string | *"MIT"
		author:      string | *"Mark Russell <marktheprogrammer17@gmail.com>"
		devDependencies: {
			"@mark1russell7/cue": string | *"github:mark1russell7/cue#main"
			typescript:           string | *"^5.9.3"
			...
		}
		keywords: [...string] | *[]
		repository: {
			type: string | *"git"
			url:  string | *"https://github.com/mark1russell7/\(_shortName).git"
		}
		bugs: url:     string | *"https://github.com/mark1russell7/\(_shortName)/issues"
		homepage:      string | *"https://github.com/mark1russell7/\(_shortName)#readme"
		publishConfig: access: "public" | *"public" | "restricted"
		engines: {
			node: string | *">=25.0.0"
			npm:  string | *">=11.0.0"
		}
	}
}

// CLI package template
#CLITemplate: {
	_name:      string
	_scope:     string | *"@mark1russell7"
	_fullName:  "\(_scope)/\(_name)"
	_shortName: _name

	output: #PackageJson & {
		$schema:     "https://json.schemastore.org/package"
		name:        _fullName
		version:     string | *"0.0.0"
		description: string | *"Package description"
		license:     string | *"MIT"
		author:      string | *"Mark Russell <marktheprogrammer17@gmail.com>"
		type:        "module"
		keywords: [...string] | *[]
		repository: {
			type: string | *"git"
			url:  string | *"https://github.com/mark1russell7/\(_shortName).git"
		}
		bugs: url:     string | *"https://github.com/mark1russell7/\(_shortName)/issues"
		homepage:      string | *"https://github.com/mark1russell7/\(_shortName)#readme"
		publishConfig: access: "public" | *"public" | "restricted"
		engines: {
			node: string | *">=25.0.0"
			npm:  string | *">=11.0.0"
		}
	}
}

// @mark1russell7/cue package.json (dogfooding)
// Run: cue eval ./npm/package/*.cue -e cuePackage --out json > package.json
cuePackage: (#CLITemplate & {_name: "cue"}).output & {
	description: "Shared CUE schemas and templates for TypeScript project configuration"
	main:        "./dist/cli.js"
	types:       "./dist/cli.d.ts"
	bin: {
		"cue-config": "./dist/cli.js"
	}
	files: ["dist", "cue.mod", "ts", "npm", "gitignore"]
	scripts: {
		build:           "tsc -b"
		"generate:self": "cue eval ./npm/package/*.cue -e cuePackage --out json > package.json"
		prepare:         "npm run build"
	}
	devDependencies: {
		"@types/node": "^22.0.0"
		typescript:    "^5.9.3"
	}
	keywords: ["cue", "typescript", "config", "schema", "validation", "gitignore"]
}
