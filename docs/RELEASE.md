# Release Guide

## Voraussetzungen

- `gh` CLI authentifiziert (`gh auth login`)
- Git Remote konfiguriert
- Alle Änderungen committed und gepusht

## Release erstellen

### 1. CI prüfen

Sicherstellen, dass der letzte Push auf `main` grün ist:

```bash
gh run list --limit 1
```

### 2. CHANGELOG aktualisieren

Neuen Abschnitt in `CHANGELOG.md` hinzufügen:

```markdown
## v0.2.0 (YYYY-MM-DD)

### Added
- ...

### Fixed
- ...
```

Committen und pushen:

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for v0.2.0"
git push origin main
```

### 3. Tag erstellen und pushen

```bash
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

Das triggert automatisch die Release-Pipeline (`release.yml`), die:
- Multi-Arch Docker Images baut (amd64 + arm64)
- Images nach GHCR pusht (`ghcr.io/timhasenkamp/infraview-osp-*:v0.2.0`)

### 4. GitHub Release erstellen

```bash
gh release create v0.2.0 \
  --title "v0.2.0 — Kurze Beschreibung" \
  --notes "Release Notes hier" \
  --prerelease
```

Oder ohne `--prerelease` für stabile Releases.

### 5. Release-Pipeline prüfen

```bash
gh run list --workflow release.yml --limit 1
```

## Versionierung

Wir nutzen [Semantic Versioning](https://semver.org/):

- **0.x.0** — Preview/Beta, breaking changes möglich
- **x.0.0** — Major, breaking changes
- **0.x.0** — Minor, neue Features
- **0.0.x** — Patch, Bugfixes

## Docker Images

Nach erfolgreichem Release sind die Images verfügbar:

```
ghcr.io/timhasenkamp/infraview-osp-frontend:v0.2.0
ghcr.io/timhasenkamp/infraview-osp-backend:v0.2.0
ghcr.io/timhasenkamp/infraview-osp-agent:v0.2.0
```

## Hotfix Release

Falls ein dringender Fix auf einem bestehenden Release nötig ist:

```bash
# Fix committen
git add .
git commit -m "fix: beschreibung"
git push origin main

# Patch-Tag erstellen
git tag -a v0.1.1 -m "v0.1.1 — Hotfix"
git push origin v0.1.1

# Release erstellen
gh release create v0.1.1 --title "v0.1.1 — Hotfix" --notes "- Fix: ..."
```
