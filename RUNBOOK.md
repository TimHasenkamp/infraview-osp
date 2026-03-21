# Runbook

Häufige Probleme und Lösungen für den InfraView-Betrieb.

## Agent verbindet sich nicht

**Symptom:** Server taucht nicht im Dashboard auf, Agent-Logs zeigen `Connection failed`.

**Diagnose:**
```bash
# Agent-Logs prüfen
docker compose logs agent

# Backend erreichbar?
curl http://localhost:8000/api/health
```

**Ursachen & Lösungen:**

| Ursache | Lösung |
|---------|--------|
| Backend noch nicht gestartet | Agent wartet und reconnected automatisch |
| Falscher `AGENT_API_KEY` | Key in Agent und Backend abgleichen |
| Firewall blockiert Port 8000 | Port freigeben |
| DNS/Hostname nicht auflösbar | `INFRAVIEW_BACKEND_URL` mit IP statt Hostname setzen |

---

## Server zeigt "offline" obwohl Agent läuft

**Symptom:** Dashboard zeigt Server als offline, Agent sendet aber Daten.

**Diagnose:**
```bash
# Agent health check
curl http://<agent-host>:8081/health

# Detaillierten Health-Check am Backend
curl http://localhost:8000/api/health/detailed
```

**Ursachen & Lösungen:**

| Ursache | Lösung |
|---------|--------|
| Agent Timeout zu niedrig | `AGENT_TIMEOUT_SECONDS` erhöhen (default: 30) |
| WebSocket-Verbindung unterbrochen | Agent reconnected automatisch, kurze Ausfälle normal |
| Netzwerk-Latenz | `INFRAVIEW_INTERVAL` erhöhen (z.B. auf 10s) |

---

## Prozess-Monitoring zeigt keine Daten

**Symptom:** "No process data available" im Dashboard.

**Diagnose:**
```bash
# Prüfen ob pid:host gesetzt ist
docker inspect infraview-osp-agent-1 | grep PidMode

# Prüfen ob /proc gemountet ist
docker exec infraview-osp-agent-1 ls /host/proc
```

**Lösung:** Agent braucht `pid: host` und `/proc:/host/proc:ro` Mount plus `HOST_PROC=/host/proc`. Siehe docker-compose.yml.

---

## Datenbank wird zu groß

**Symptom:** `infraview.db` wächst unkontrolliert.

**Diagnose:**
```bash
# DB-Größe prüfen
ls -lh data/infraview.db

# Metrik-Anzahl prüfen
sqlite3 data/infraview.db "SELECT COUNT(*) FROM metrics;"
```

**Lösungen:**
- `METRIC_RETENTION_DAYS` reduzieren (default: 30)
- Downsampling aktivieren falls deaktiviert: `DOWNSAMPLE_ENABLED=true`
- Aggressivere Downsampling-Stufen setzen (z.B. `DOWNSAMPLE_1MIN_AFTER_HOURS=2`)
- Manuelle Bereinigung: `sqlite3 data/infraview.db "DELETE FROM metrics WHERE timestamp < datetime('now', '-7 days');"`

---

## Alerts werden nicht gesendet

**Symptom:** Alert feuert, aber keine Email/Webhook kommt an.

**Diagnose:**
```bash
# Backend-Logs nach Notification-Fehlern durchsuchen
docker compose logs backend | grep -i "notification\|email\|webhook\|smtp"

# SMTP-Config prüfen (Settings-Seite oder API)
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/settings
```

**Ursachen & Lösungen:**

| Ursache | Lösung |
|---------|--------|
| SMTP nicht konfiguriert | Settings-Seite → Email/SMTP ausfüllen |
| SMTP-Credentials falsch | Host, Port, User, Password prüfen |
| Webhook-URL nicht erreichbar | URL testen: `curl -X POST <url>` |
| Cooldown aktiv | Alert feuert nur alle `cooldown_seconds` (default: 300s) |

---

## Backup & Restore

**Backup erstellen:**
```bash
# Über API
curl -X POST -H "Authorization: Bearer <token>" http://localhost:8000/api/backup

# Oder Datei direkt downloaden
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/backup/download -o backup.db

# Oder manuell
cp data/infraview.db data/backups/manual_backup_$(date +%Y%m%d).db
```

**Backup listen:**
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/backup/list
```

**Restore:**
```bash
# Über API (erstellt automatisch Safety-Backup)
curl -X POST -H "Authorization: Bearer <token>" \
  -F "file=@backup.db" \
  http://localhost:8000/api/backup/restore

# Oder manuell
docker compose stop backend
cp backup.db data/infraview.db
docker compose start backend
```

---

## Performance-Probleme im Dashboard

**Symptom:** Dashboard lädt langsam, Charts ruckeln.

**Lösungen:**
- Kürzeren Time-Range wählen (1h statt 7d)
- Downsampling-Schwellen anpassen (Settings → Data & Retention)
- `METRIC_RETENTION_DAYS` reduzieren
- Browser DevTools → Network Tab prüfen ob API-Responses groß sind

---

## Container-Aktionen schlagen fehl

**Symptom:** Start/Stop/Restart eines Containers gibt Fehler.

**Diagnose:**
```bash
# Docker-Socket gemountet?
docker exec infraview-osp-agent-1 ls -la /var/run/docker.sock

# Agent-Logs
docker compose logs agent | grep -i "container"
```

**Lösung:** `/var/run/docker.sock:/var/run/docker.sock:ro` muss im Agent-Container gemountet sein.

---

## Login funktioniert nicht

**Symptom:** "Invalid credentials" trotz korrektem Passwort.

**Diagnose:**
```bash
# Initial-Credentials anzeigen
cat data/initial_credentials.txt

# Oder in den Logs suchen
docker compose logs backend | grep "Password"
```

**Lösung:** Beim ersten Start wird ein Zufallspasswort generiert und in `data/initial_credentials.txt` gespeichert. Passwort kann über Settings-Seite oder API geändert werden.

---

## Prometheus-Scraping einrichten

**prometheus.yml:**
```yaml
scrape_configs:
  - job_name: infraview
    scrape_interval: 15s
    static_configs:
      - targets: ["localhost:8000"]
    metrics_path: /api/metrics
```
