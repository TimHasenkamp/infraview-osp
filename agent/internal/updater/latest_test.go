package updater

import "testing"

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"v0.3.8", "v0.3.7", 1},
		{"v0.3.7", "v0.3.8", -1},
		{"v0.3.8", "v0.3.8", 0},
		{"0.4.0", "v0.3.9", 1},
		{"v1.0.0", "v0.9.9", 1},
		{"v0.3.8-rc.1", "v0.3.8", 0}, // pre-release suffix ignored
	}
	for _, c := range cases {
		if got := compareVersions(c.a, c.b); got != c.want {
			t.Errorf("compareVersions(%q,%q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestUpdateAvailableDevIsFalse(t *testing.T) {
	if UpdateAvailable(nil, "dev") {
		t.Error("dev build should never report an update available")
	}
}
