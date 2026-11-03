# Roadmap

This file is the plan of cue. The Status page of the site reads it.

| ID | Item | Status | Summary |
| --- | --- | --- | --- |
| C1 | The site and the core entry | in progress | The site at `mark1russell7.github.io/cue` starts the core of the package (`@mark1russell7/cue/core`) in the browser. CI makes the record of `cue eval` again and compares it. |
| C2 | The conventions check in CI | not started | CI starts the conventions check of `@mark1russell7/conventions` on each pull request. |
| C3 | No build output in git | not started | Git keeps `dist/`, because other repositories install this package from git. When they install it from npm, `dist/` goes out of git. |
