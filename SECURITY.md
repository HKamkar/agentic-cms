# Security

## Reporting a vulnerability

Report it privately through GitHub: the repository's **Security** tab,
**Report a vulnerability**. Please do not open a public issue, pull request
or discussion for it. A fix ships as a patch release, with a line in
`CHANGELOG.md` and the steps, if any, in `docs/upgrading.md`.

## Supported versions

The latest release (the newest `v*` tag) gets fixes. A site pins the package
by tag, so it takes a fix by moving its pin to that release.

## Scope

The package (`src/lib/`, the `agentic-cms` command line in `bin/` and
`scripts/`), the files `agentic-cms init` writes into a site
(`templates/site/`), and the example site in this repository. A
vulnerability in a dependency is in scope when the package or the example
reaches the vulnerable code; otherwise report it upstream.
