# Datenschutzhinweis

**Stand: 08.11.2026.**
Produkt: eigenständiger KNX-MCP-Client für ETS-App 1.2.0.4 und kompatible Folgeversionen.
Herausgeber/Kontakt: Gerald Docenko, support@knx-mcp.com. Dieser Hinweis beschreibt die technische Verarbeitung durch den Client; für separate Dienste gelten deren eigene Hinweise.

## Verarbeitung

Die Erweiterung liest die in Claude ausgewählten Verbindungsdateien, ihre lokalen Identitätsmerker sowie bis zu zwei vom Host über festgelegte Umgebungsvariablen übergebene manuelle Verbindungsblöcke. Die Profile enthalten Anzeigename, Endpunkt, Kennung, Zugangsschlüssel im Klartext sowie öffentliches Zertifikat/Fingerabdruck. Private Zertifikatsschlüssel werden nicht aus ETS exportiert. Kein Verzeichnis-Scan und kein Lesen fremder Dateien, Chatverläufe oder Claude-Erinnerungen. Der KI-Host übergibt die Parameter angeforderter Werkzeugaufrufe.

## Übertragung

Profilverbindungen übertragen Anmeldung und MCP-Anfragen per HTTPS an den festgelegten ETS-Endpunkt mit Zertifikats-, Namens- und Fingerabdruckprüfung. Manuelles HTTPS prüft Namen und Zertifikat anhand der unterstützten Standard-/Systemvertrauensquellen. Manuelles HTTP erfordert eine ausdrückliche Freigabe und überträgt Schlüssel und Projektdaten unverschlüsselt. Keine HTTP-Weiterleitungen und kein automatischer Wechsel von HTTPS auf HTTP. Kein vom Entwickler betriebener Vermittlungsserver und keine eigene Telemetrie im Client. Werkzeugkatalog, Serverhinweise, Argumente und Ergebnisse können Projekt-/Kundennamen, Gebäudestrukturen, Adressen, Geräteinformationen und Kommentare enthalten. Ergebnisse werden über stdio an Claude übergeben und können entsprechend Konto, Bedingungen und Einstellungen beim KI-Anbieter verarbeitet werden. Daher bleiben nicht pauschal alle Daten lokal. Die erforderliche Berechtigung zur Übermittlung der Projektdaten muss für die jeweilige Anlage vorliegen.

## Aufbewahrung und Löschung

Die Profile bleiben bis zum Löschen am gewählten Ort und werden durch die Dateiauswahl nicht verschlüsselt. Dateirechte, Sicherungen und Synchronisation müssen geschützt werden. Unter `%LOCALAPPDATA%/KNX-MCP/Claude/identities` bleiben öffentliche Identitätsmerker mit Endpunkt, Profilkennung und Zertifikatsfingerabdruck; kein Zugangsschlüssel und keine Projektinhalte. Sitzungen, Schlüssel und Antworten befinden sich während der Nutzung im Prozessspeicher; eine garantierte sichere Speicherlöschung wird nicht behauptet. Der Adapter legt keine Rohdaten-Projektlogdatei an. Claude kann eigene Konfigurationen und Diagnoseprotokolle speichern. Die getrennte ETS-App besitzt eigene Diagnoseoptionen, manuelle Exporte und Debug-Live-Logs.

Zum Beenden die Erweiterung deaktivieren/entfernen. Profile und bei Bedarf Identitätsmerker gezielt löschen. Die Deinstallation garantiert keine Löschung von Claude-Protokollen oder externen Sicherungen. Bei offengelegtem Profil den Zugangsschlüssel in ETS ändern und neue Profile exportieren. Profile, Schlüssel und unbereinigte Kundenlogs nicht an den Support senden. ETS-Freigaben und Bestätigungen gelten unverändert.

## Optionale manuelle Testverbindungen

Zwei vollständig benannte Verbindungen können in Claude erfasst werden. Bearer-Token sind sensible Host-Einstellungen und werden über die Prozessumgebung statt über Befehlsargumente übergeben; der Adapter speichert sie nicht selbst auf Datenträger. Manuelles HTTPS verwendet Standard- und unterstützte Systemzertifikate, ohne einen Vertrauensspeicher zu verändern. Ausdrücklich erlaubtes HTTP überträgt Token und Projektdaten unverschlüsselt. Profile behalten ihre genaue Zertifikatsbindung und wechseln niemals automatisch auf HTTP. Technische Grenzen: SECURITY.md.

Die Startdiagnose enthält zusätzlich eine zufällige Kennung je Prozess, Prozess-ID, Startzeit, Node-Laufzeitversion und Zähler beziehungsweise Vorhandenseinsangaben der explizit übergebenen Eingaben. Lokale Statuswerkzeuge geben diese Angaben an den Host zurück; stderr enthält sie zur Zuordnung von Protokolleinträgen. Profilpfade, Verbindungswerte und Zugangsschlüssel sind nicht enthalten. Der Client speichert diese Diagnose nicht separat und übermittelt sie nicht an den Herausgeber. Die Aufbewahrung der Host-Protokolle bestimmt der Host.
