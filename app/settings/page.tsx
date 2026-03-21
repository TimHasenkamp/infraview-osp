"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Key, Mail, Database, Radio } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { API_BASE_URL } from "../_lib/constants";

interface SettingDef {
  value: string;
  label: string;
  category: string;
  type: string;
}

type SettingsMap = Record<string, SettingDef>;

const CATEGORY_CONFIG = {
  email: { label: "Email / SMTP", icon: Mail, description: "SMTP settings for email alerts" },
  data: { label: "Data & Retention", icon: Database, description: "Metric storage and downsampling" },
  agent: { label: "Agent", icon: Radio, description: "Agent connection settings" },
} as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/settings`)
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setEdited((prev) => ({ ...prev, [key]: value }));
  };

  const getValue = (key: string) => {
    if (key in edited) return edited[key];
    return settings[key]?.value ?? "";
  };

  const hasChanges = Object.keys(edited).length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ settings: edited }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`${data.updated.length} setting(s) updated`);
      setEdited({});
      // Reload settings
      const fresh = await fetch(`${API_BASE_URL}/settings`);
      setSettings(await fresh.json());
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || "Failed to change password");
        return;
      }
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Connection failed");
    }
  };

  const categories = Object.entries(CATEGORY_CONFIG);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-6 space-y-6 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>

        {/* Password Change */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Current Password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="min. 8 characters"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirm</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              <Button type="submit" size="sm" variant="secondary" className="h-8 text-xs">
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Settings Categories */}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading settings...</div>
        ) : (
          <>
            {categories.map(([catKey, catConfig]) => {
              const Icon = catConfig.icon;
              const catSettings = Object.entries(settings).filter(
                ([, def]) => def.category === catKey
              );
              if (catSettings.length === 0) return null;

              return (
                <Card key={catKey}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {catConfig.label}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{catConfig.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {catSettings.map(([key, def]) => (
                        <div key={key} className="space-y-1.5">
                          <Label className="text-xs">{def.label}</Label>
                          {def.type === "bool" ? (
                            <select
                              value={getValue(key)}
                              onChange={(e) => handleChange(key, e.target.value)}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="True">Enabled</option>
                              <option value="False">Disabled</option>
                            </select>
                          ) : (
                            <Input
                              type={key.includes("pass") ? "password" : def.type === "int" ? "number" : "text"}
                              value={getValue(key)}
                              onChange={(e) => handleChange(key, e.target.value)}
                              className={key in edited ? "border-primary" : ""}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {hasChanges && (
              <div className="sticky bottom-4 flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
