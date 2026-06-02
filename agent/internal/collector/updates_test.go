package collector

import "testing"

func TestParseAptPhased(t *testing.T) {
	output := []byte(`Reading package lists... Done
Building dependency tree... Done
Calculating upgrade... Done
The following upgrades have been deferred due to phasing:
  cloud-init libfoo
0 upgraded, 0 newly installed, 0 to remove and 2 not upgraded.
`)
	phased := parseAptPhased(output)
	if len(phased) != 2 {
		t.Fatalf("expected 2 phased packages, got %d: %v", len(phased), phased)
	}
	if !phased["cloud-init"] || !phased["libfoo"] {
		t.Errorf("expected cloud-init and libfoo, got %v", phased)
	}
}

func TestParseAptPhasedNone(t *testing.T) {
	output := []byte(`Reading package lists... Done
Calculating upgrade... Done
0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.
`)
	if phased := parseAptPhased(output); len(phased) != 0 {
		t.Errorf("expected no phased packages, got %v", phased)
	}
}

func TestFilterPhased(t *testing.T) {
	pkgs := []PackageUpdate{
		{Name: "vim"},
		{Name: "cloud-init"},
		{Name: "openssl"},
	}
	got := filterPhased(pkgs, map[string]bool{"cloud-init": true})
	if len(got) != 2 {
		t.Fatalf("expected 2 packages after filtering, got %d: %v", len(got), got)
	}
	for _, p := range got {
		if p.Name == "cloud-init" {
			t.Errorf("cloud-init should have been filtered out")
		}
	}

	// No phased set → list unchanged.
	if got := filterPhased(pkgs, nil); len(got) != 3 {
		t.Errorf("expected list unchanged with empty phased set, got %d", len(got))
	}
}

func TestParseAptLine(t *testing.T) {
	regular := parseAptLine("vim/noble-updates 2:9.1.0016-1ubuntu7.8 amd64 [upgradable from: 2:9.1.0016-1ubuntu7.7]")
	if regular.Name != "vim" {
		t.Errorf("name: got %q, want vim", regular.Name)
	}
	if regular.NewVersion != "2:9.1.0016-1ubuntu7.8" {
		t.Errorf("new version: got %q", regular.NewVersion)
	}
	if regular.CurrentVersion != "2:9.1.0016-1ubuntu7.7" {
		t.Errorf("current version: got %q", regular.CurrentVersion)
	}
	if regular.Security {
		t.Errorf("expected security=false for noble-updates")
	}

	security := parseAptLine("openssl/noble-security 3.0.13-0ubuntu3.4 amd64 [upgradable from: 3.0.13-0ubuntu3.3]")
	if !security.Security {
		t.Errorf("expected security=true for noble-security: %+v", security)
	}

	if header := parseAptLine("Listing..."); header.Name != "" {
		t.Errorf("expected empty package for header line, got %+v", header)
	}
}
