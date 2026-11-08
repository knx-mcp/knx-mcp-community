# KNX-MCP für Claude Desktop

[English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Čeština](README.cs.md) · [Italiano](README.it.md) · [Русский](README.ru.md)

Verbindet Claude Desktop mit einer oder mehreren benannten ETS5-/ETS6-Instanzen
unter Windows. Jedes Werkzeug zeigt seine Zielverbindung an. So lassen sich
mehrere Standorte mit getrennten Sitzungen, Zugangsschlüsseln und
Zertifikatsvertrauen verwenden.

| Auf einen Blick | Angaben |
| --- | --- |
| Client | **1.0.4** |
| Installationspaket | `KNX-MCP-1.0.4.mcpb` |
| Kompatibilitätsbasis der ETS-App | KNX-MCP **1.2.0.4** und kompatible Folgeversionen |
| Plattform | Claude Desktop unter Windows |
| Laufzeit | Node.js **ab 22.16.0**, vom Host bereitgestellt |
| Herausgeber | Gerald Docenko |
| Support | [support@knx-mcp.com](mailto:support@knx-mcp.com) |

Client und ETS-App haben unabhängige Versionsnummern. Der Client benötigt keine
zusätzlichen JavaScript-Laufzeitpakete und lädt beim Start keine Pakete nach.

## Voraussetzungen

Für die Einrichtung werden benötigt:

- Eine lizenzierte **ETS5- oder ETS6-Installation**.
- Die **KNX-MCP ETS-App**, separat über MyKNX installiert.
- **Claude Desktop unter Windows** mit Unterstützung für MCPB-Erweiterungen.
- Eine Netzwerkverbindung vom Claude-Rechner zu jedem gewünschten ETS-Endpunkt.

Die `.mcpb` installiert die Claude-Erweiterung. Die ETS-App wird separat auf dem
Rechner mit ETS installiert. Andere Hosts oder Ausführungsmodi können sich
unterschiedlich verhalten.

## Installation mit exportierten Profilen

### 1. ETS vorbereiten und ein Profil exportieren

1. Das gewünschte Projekt in ETS öffnen und seinen MCP-Endpunkt im KNX-MCP-Panel
   starten.
2. Unter **Server-Einstellungen → HTTPS Einstellungen** HTTPS aktivieren, ein zur
   Endpunktadresse passendes Zertifikat auswählen oder erstellen und die
   Einstellungen übernehmen.
3. Unter **Claude One-Click-Installation KNX-MCP** einen eindeutigen Verbindungsnamen
   vergeben und `KNX-MCP-<Name>.json` in einem privaten, dauerhaften Ordner speichern.

Diese Schritte für jeden weiteren gewünschten ETS-Endpunkt wiederholen.

### 2. Die Erweiterung in Claude installieren

1. **`KNX-MCP-1.0.4.mcpb`** in Claudes Erweiterungseinstellungen installieren.
2. Unter **Verbindungsprofile (empfohlen)** die exportierten Profildateien auswählen
   und speichern. Es können bis zu **32 Profile** ausgewählt werden.
3. Claude vollständig beenden, einschließlich des Prozesses im Infobereich,
   und neu starten.
4. Einen **neuen Chat** mit aktiviertem KNX-MCP öffnen.

Die [Paketübersicht](release/README.md) erklärt die Lieferdateien und Prüfsummen.

### 3. Die Verbindung prüfen

1. Claude zuerst **`knx_connections`** aufrufen lassen.
2. Anschließend für jede gewünschte Verbindung tatsächlich
   **`ets_list_projects`** aufrufen lassen.
3. Den gemeldeten Server und das Projekt vor Änderungen prüfen.
   In ETS zunächst **Nur Lesen** einschalten.

### Profile schützen und am Speicherort belassen

Die Profile verwenden das Format `knx-mcp-claude/v1`:

- Ein Profil enthält einen **Zugangsschlüssel im Klartext** und das öffentliche
  Serverzertifikat. Der private Zertifikatsschlüssel ist nicht enthalten.
- Das Zertifikatsvertrauen gilt gezielt für diese Verbindung. Es wird kein
  systemweiter Vertrauenseintrag angelegt.
- Ausgewählte Dateien am gespeicherten Pfad belassen. Nach Verschieben oder
  Umbenennen die Dateiauswahl in Claude aktualisieren und Claude vollständig
  neu starten.

**Profile niemals in Chats, Supporttickets oder öffentliche Repositories hochladen.**

## Mehrere Verbindungen und Werkzeugnamen

Eindeutige Namen wie `Office-ETS5` und `Office-ETS6` verwenden. Ein zugeordnetes
Werkzeug heißt beispielsweise `Office-ETS6__ets_list_projects`; sein Anzeigetitel
enthält den vollständigen Verbindungsnamen.

- Nicht unterstützte Zeichen werden im technischen Werkzeugnamen normalisiert.
- Doppelte oder lange Namen können einen unterscheidenden Zusatz erhalten.
- Nicht erreichbare Verbindungen behalten ihren Namensraum. Aufrufe werden bei
  einem Ausfall niemals auf einen anderen Standort umgeleitet.

Ein Anzeigename ist eine Bezeichnung und kein Nachweis der entfernten ETS-Version.
Vor Änderungen den gemeldeten Server und das aktuelle Projekt prüfen.

## Zwei optionale manuelle Verbindungen

Exportierte Profile und manuelle Verbindungen können einzeln oder gemeinsam
verwendet werden. Jede manuelle Verbindung hat drei Felder:

| Feld | Eingabe |
| --- | --- |
| **Name** | Ein eindeutiger, verständlicher Verbindungsname |
| **Remote / Local URL** | Eine vollständige Adresse, beispielsweise `https://ets-pc.example:51900/mcp` |
| **Bearer token** | Nur der Zugangsschlüssel, ohne das Wort `Bearer` |

**Alle drei Felder eines Blocks vollständig ausfüllen oder alle drei leer lassen.**
Denselben Endpunkt nicht zweimal eintragen; mehrdeutige Einträge werden deaktiviert.

Ohne Pfad wird `/mcp` ergänzt. `localhost` bezeichnet den Claude-Rechner.
ETS kann auf einem anderen Rechner laufen.

### HTTPS

Das Zertifikat muss zum Hostnamen oder zur IP-Adresse der URL passen und von den
unterstützten Node-/Windows-Vertrauensquellen des Claude-Kontos akzeptiert werden.

Nur ein geprüftes öffentliches Zertifikat importieren oder ein exportiertes
Profil verwenden. Die Erweiterung verändert keine Zertifikatsspeicher.

### HTTP für gezielte Tests

**Unverschlüsseltes HTTP für Testverbindungen erlauben** ausdrücklich einschalten,
auch bei Loopback. HTTP überträgt Zugangsschlüssel und Projektdaten ohne TLS.
Die Option deshalb nur für bewusst gewählte lokale oder anderweitig geschützte
Tests verwenden.

Es gibt keinen stillen Wechsel von HTTPS zu HTTP. Weiterleitungen werden abgelehnt.

## Status und Wiederanlauf

### Ein Ziel prüfen oder erneut verbinden

| Lokales Werkzeug | Zweck |
| --- | --- |
| `knx_connections` | Client-/Serverversion, Verbindungszustand, Werkzeuganzahl sowie Einrichtungs-, Transport- und Aufruffehler anzeigen |
| `knx_refresh_connections` | Geladene Ziele erneut verbinden, optional nur eine `connection`-Kennung |

Zur Diagnose enthält der Status auch Prozesskennungen und Zähler der übergebenen
Eingaben, jedoch keine Profilpfade oder Zugangsdaten. Er zeigt die **letzte
Beobachtung**, keine laufende Überwachung.

Die Aktualisierung verwendet die bereits geladene Konfiguration. Nach Änderungen
an gespeicherten Host-Einstellungen oder ausgewählten Profildateien Claude
vollständig neu starten. Die Aktualisierung sucht keine Dateien und lädt diese
Einstellungen nicht nach.

### Wenn Werkzeuge erst später erscheinen

Die Ziele werden unabhängig geladen. Die erste Werkzeugliste wartet höchstens
eine gemeinsame Sekunde auf bereits laufende Katalogabrufe. Initialisierung und
Status bleiben dabei ansprechbar; spätere Kataloge lösen Änderungsmeldungen aus.

Übernimmt der Host einen später eintreffenden Katalog nicht, Claude vollständig
neu starten, sobald der ETS-Endpunkt bereitsteht.

### Nach Verbindungs- oder Sitzungsverlust

| Vorgang | Zeitlimit |
| --- | --- |
| Verbindungsaufbau | Insgesamt 15 Sekunden |
| Werkzeuganfrage | 180 Sekunden |

Aufrufe werden je Endpunkt geordnet. Die Warteschlange eines Standorts blockiert
dadurch nicht alle anderen Standorte. Nach erkanntem Sitzungsverlust kann ein
Leseaufruf einmal wiederholt werden. Eine Änderung mit verlorener Antwort wird
**niemals automatisch erneut ausgeführt**.

Bei **`PROJECT_RECHECK_REQUIRED`** wurde die Änderung zurückgehalten:

1. Die aktuelle Projektliste und die betroffenen Objekte lesen.
2. Eine ausdrückliche Projektkennung verwenden und das Ziel erneut prüfen.
3. Die beabsichtigte Änderung anschließend bewusst erneut beauftragen.

ETS-Freigaben und Bestätigungen bleiben maßgeblich.

## Aktualisierung und Entfernung

### Ein Update installieren

Community-Pakete werden manuell aktualisiert:

1. Die neuere MCPB mit derselben technischen Kennung `knx-mcp-claude` installieren.
2. Gültige v1-Profile ausgewählt lassen.
3. Claude vollständig beenden, neu starten und einen neuen Chat öffnen.
4. Die Verbindung und die aktuellen Projekte erneut prüfen.

Nach Änderungen an Dateiauswahl, Schlüsseln oder Zertifikatsvertrauen genauso neu
starten. Die im neuen Chat geladenen Werkzeuge verwenden; keine Werkzeugnamen
aus alten Chatverläufen übernehmen.

### Endpunktadresse oder Zertifikat ändern

Die Änderung in ETS prüfen, ein Profil unter **neuem Dateinamen** exportieren und
die bisherige Auswahl in Claude ersetzen. Stille Identitätsänderungen am selben
Profilpfad werden abgelehnt.

### Die Erweiterung entfernen

Beim Entfernen der Erweiterung bleiben Profildateien und Zertifikate erhalten.
Auch die nicht geheimen Identitätsmerker bleiben unter
`%LOCALAPPDATA%/KNX-MCP/Claude/identities` gespeichert. Ihr Löschen entfernt die
bisherige Änderungserkennung.

## Datenschutz

Werkzeugbeschreibungen, Argumente und Ergebnisse können Projekt- oder Kundendaten
enthalten. Ergebnisse gehen an Claude und können durch dessen KI-Dienst
verarbeitet werden. Die gesamte Kommunikation ist deshalb nicht ausschließlich lokal.

Der Client besitzt keinen Vermittlungsserver des Herausgebers, keine Telemetrie
und keinen automatischen Upload an den Herausgeber. Profile, Sicherungen und Logs
schützen und sicherstellen, dass Projektdaten an den KI-Dienst weitergegeben
werden dürfen.

Weitere Informationen stehen im [Datenschutzhinweis](PRIVACY.de.md) und in den
[Sicherheitshinweisen](SECURITY.md).

## Hilfe, Quellen und Lizenz

| Thema | Dokument |
| --- | --- |
| Einrichtungs- und Verbindungsfehler | [Fehlerhilfe](TROUBLESHOOTING.md) |
| Fragen und Fehlermeldungen | [Support](SUPPORT.md) |
| Paketdateien und Prüfsummen | [Paketübersicht](release/README.md) |
| Enthaltene Funktionen | [Versionshinweise](release/CHANGELOG.md) |
| Build, Tests und Quellenexport | [Entwicklung](DEVELOPMENT.md) |

Für Fehlermeldungen die Versionen, reproduzierbare Schritte und eine bereinigte
Diagnose angeben. Private Profile und Schlüssel niemals beifügen.
Die weiterführenden technischen Unterlagen sind Englisch.

Die [MIT-Lizenz](LICENSE.txt) gilt für diesen eigenständigen Client und seine
Textdokumentation. Für die proprietäre ETS-App, Core und SDK gelten separate
Bedingungen. Das Branding unterliegt der [Lizenz für Grafiken](assets/LICENSE.txt).

Version und Herausgeber stehen in `manifest.json`; Vorbereitungsdatum und
ETS-App-Basis in `release-info.json`. Gebaute Pakete enthalten einen
Quellfingerabdruck in `build-info.json` und eine separate SHA256-Prüfsummendatei.
