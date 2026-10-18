# KNX-MCP Community – Deutsch

**KNX-MCP** ist eine ETS-App, die das geöffnete ETS-Projekt über das Model Context Protocol (MCP) mit MCP-fähigen KI-Assistenten verbindet.

Aktuelle Version: **1.1.0.0 · Release 1**  
Unterstützt: **ETS5 ab 5.7 und ETS6**  
Bezug: derzeit **kostenlos** über den KNX Online Shop.

## Wofür ist dieses Repository gedacht?

- Fragen und Antworten
- Einrichtungs- und Praxisbeispiele
- Fehlermeldungen
- Funktionswünsche
- wiederverwendbare Skills und Prompts
- Versionshinweise

Der Quellcode der KNX-MCP-App ist **nicht** Bestandteil dieses öffentlichen Repositories.

## Kontrolle und Sicherheit

KNX-MCP kennt je Werkzeug drei Freigabestufen: **erlaubt**, **Bestätigung erforderlich** und **gesperrt**. Zusätzlich gibt es einen Nur-Lesen-Modus je Projekt. Projektänderungen erscheinen als benannte Rückgängig-Schritte in ETS; Geräteprogrammierung ist standardmäßig gesperrt.

Der MCP-Endpunkt ist standardmäßig nur lokal auf dem ETS-Rechner erreichbar. KNX-MCP betreibt keinen zentralen Cloud-Dienst, über den Projektdaten laufen. Welcher KI-Anbieter Daten verarbeitet, hängt vom verbundenen MCP-Client ab.

## Wohin mit welchem Thema?

- allgemeine Fragen / Workflows → **Discussions**
- reproduzierbarer Fehler → **Issues / Bug report**
- Idee / Erweiterungswunsch → **Discussions** oder **Feature request**
- Sicherheitsproblem → **nicht öffentlich**, siehe `SECURITY.md`
- vertrauliche oder geschäftliche Anfrage → `support@knx-mcp.com`

Bitte keine KNX-Projektdateien, Kundendaten, Passwörter, Zugangsschlüssel oder KNX-Secure-Schlüssel öffentlich hochladen.
## Weitere Anleitungen

- [Installation und Verbindung (Englisch)](getting-started.md)
- [Häufige Fragen / FAQ (Englisch)](faq.md)
- [KNX-MCP Skills und Praxisabläufe (Englisch)](../skills/README.md)
- [Projektübersicht nur lesend (Englisch)](../skills/project-overview-read-only.md)

Skills sind **optional** und ersetzen keine KNX-MCP-Freigaben.
