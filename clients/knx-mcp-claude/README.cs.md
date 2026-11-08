# KNX-MCP pro Claude Desktop

[English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Čeština](README.cs.md) · [Italiano](README.it.md) · [Русский](README.ru.md)

Připojte Claude Desktop k jedné nebo více pojmenovaným instancím ETS5/ETS6 ve
Windows. Každý nástroj označuje své cílové připojení. Můžete tak pracovat s více
lokalitami, aniž by se mísily jejich relace, přístupové údaje nebo důvěra
v certifikáty.

| Přehled | Podrobnosti |
| --- | --- |
| Klient | **1.0.4** |
| Instalační balíček | `KNX-MCP-1.0.4.mcpb` |
| Referenční verze aplikace ETS | KNX-MCP **1.2.0.4** a kompatibilní novější verze |
| Platforma | Claude Desktop ve Windows |
| Běhové prostředí | Node.js **22.16.0 nebo novější**, poskytované hostitelskou aplikací |
| Vydavatel | Gerald Docenko |
| Podpora | [support@knx-mcp.com](mailto:support@knx-mcp.com) |

Klient a aplikace ETS mají nezávislá čísla verzí. Klient nepotřebuje další běhové
balíčky JavaScriptu ani stahování balíčků při spuštění.

## Požadavky

Před instalací si připravte:

- Licencovanou instalaci **ETS5 nebo ETS6**.
- **Aplikaci KNX-MCP pro ETS**, samostatně nainstalovanou přes MyKNX.
- **Claude Desktop ve Windows** s podporou rozšíření MCPB.
- Síťový přístup z počítače s Claude ke každému požadovanému koncovému bodu ETS.

Soubor `.mcpb` instaluje rozšíření pro Claude. Aplikaci ETS nainstalujte samostatně
na počítač, na kterém běží ETS. V jiných hostitelích nebo režimech se chování může
lišit.

## Instalace pomocí exportovaných profilů

### 1. Připravte ETS a exportujte profil

1. Otevřete požadovaný projekt v ETS a v panelu KNX-MCP spusťte jeho koncový bod MCP.
2. V nastavení serveru v části **HTTPS** zapněte HTTPS, vyberte nebo vytvořte
   certifikát odpovídající adrese koncového bodu a nastavení použijte.
3. V části **Claude One-Click-Installation KNX-MCP** zadejte srozumitelný název
   připojení a uložte `KNX-MCP-<name>.json` do soukromé, trvale dostupné složky.

Tyto kroky opakujte pro každý další koncový bod ETS, který chcete používat.

### 2. Nainstalujte rozšíření do Claude

1. V nastavení rozšíření Claude nainstalujte **`KNX-MCP-1.0.4.mcpb`**.
2. V části **Profily připojení (doporučeno)** vyberte exportované profily a uložte
   nastavení. Můžete vybrat až **32 profilů**.
3. Claude úplně ukončete, včetně procesu v oznamovací oblasti, a znovu spusťte.
4. Otevřete **nový chat** se zapnutým KNX-MCP.

[Průvodce distribucí](release/README.md) vysvětluje soubory balíčku a kontrolní
součty.

### 3. Ověřte připojení

1. Požádejte Claude o zavolání **`knx_connections`**.
2. Pro každé požadované připojení nechte skutečně zavolat **`ets_list_projects`**.
3. Před změnami ověřte hlášený server a projekt. Začněte se zapnutým režimem
   **Pouze čtení** v ETS.

### Uchovávejte profily soukromě a na stálém místě

Profily používají formát `knx-mcp-claude/v1`:

- Profil obsahuje **přístupový klíč v otevřené podobě** a veřejný certifikát
  serveru. Nikdy neobsahuje soukromý klíč certifikátu.
- Důvěra v certifikát platí pouze pro dané připojení. Nevytváří se systémový
  záznam důvěry.
- Vybrané soubory ponechte na uložených cestách. Po přesunutí nebo přejmenování
  upravte výběr v Claude a aplikaci úplně restartujte.

**Profily nikdy neposílejte do chatu, hlášení podpory ani veřejných repozitářů.**

## Více připojení a názvy nástrojů

Každému připojení dejte odlišný název, například `Office-ETS5` nebo `Office-ETS6`.
Nástroj pro konkrétní připojení se může jmenovat například
`Office-ETS6__ets_list_projects`; jeho zobrazovaný název obsahuje celý název
připojení.

- Nepodporované znaky se v technických názvech nástrojů normalizují.
- Duplicitní nebo dlouhé názvy mohou dostat rozlišovací příponu.
- I nepřipojené cíle si zachovávají svůj jmenný prostor. Když je požadovaná
  lokalita nedostupná, volání se nikdy nepřesměruje na jinou.

Zobrazovaný název je označení, nikoli důkaz verze vzdálené ETS. Před změnami
ověřte hlášený server a aktuální projekt.

## Dvě volitelná ruční připojení

Můžete použít exportované profily, ruční připojení nebo obojí.
Každé ruční připojení má tři pole:

| Pole | Co zadat |
| --- | --- |
| **Název** | Srozumitelný a jedinečný název připojení |
| **Remote / Local URL** | Úplnou adresu, například `https://ets-pc.example:51900/mcp` |
| **Bearer token** | Pouze přístupový klíč, bez slova `Bearer` |

**Vyplňte všechna tři pole v bloku, nebo je všechna ponechte prázdná.**
Stejný koncový bod nenastavujte dvakrát; nejednoznačné položky se deaktivují.

Pokud URL neobsahuje cestu, doplní se `/mcp`. `localhost` označuje počítač,
na kterém běží Claude; ETS může běžet na jiném počítači.

### HTTPS

Certifikát musí odpovídat názvu hostitele nebo IP adrese v URL a musí mu důvěřovat
podporované zdroje důvěry Node/Windows pro účet, pod kterým běží Claude.

Importujte pouze ověřený veřejný certifikát, nebo použijte exportovaný profil.
Rozšíření nemění úložiště certifikátů.

### HTTP pro záměrné testování

Výslovně zapněte **Povolit nešifrované HTTP pro testovací připojení**, a to i pro
loopback. HTTP přenáší přístupové klíče a projektová data bez TLS; používejte jej
jen pro vědomě zvolené místní nebo jinak chráněné testování.

HTTPS nikdy tiše nepřejde na HTTP. Přesměrování se odmítají.

## Stav a obnovení spojení

### Ověřte nebo znovu připojte cíl

| Místní nástroj | Účel |
| --- | --- |
| `knx_connections` | Zobrazit verze klienta/serveru, stav, počty nástrojů a chyby nastavení, přenosu nebo volání |
| `knx_refresh_connections` | Znovu připojit již načtené cíle, případně pouze jeden identifikátor `connection` |

Stav obsahuje také identifikátory procesů a počty předaných vstupů pro diagnostiku,
bez cest k profilům a přístupových údajů. Jde o **poslední zjištěný stav**, nikoli
o průběžné sledování.

Obnovení používá nastavení, které již načetl běžící klient. Po změně uloženého
nastavení hostitele nebo vybraných profilů Claude úplně restartujte.
Obnovení nehledá soubory ani znovu nenačítá tato nastavení.

### Když se nástroje zobrazí později

Cíle se načítají nezávisle. První seznam nástrojů čeká nejvýše jednu společnou
sekundu na již načítané katalogy; inicializace a stav zůstávají dostupné.
Později načtené katalogy vyvolají oznámení změny.

Pokud hostitel později dostupný katalog nenačte, Claude úplně restartujte, až bude
koncový bod ETS připraven.

### Po ztrátě připojení nebo relace

| Operace | Časový limit |
| --- | --- |
| Navázání spojení | Celkem 15 sekund |
| Požadavek na nástroj | 180 sekund |

Volání se řadí pro každý koncový bod zvlášť, takže fronta jedné lokality neblokuje
všechny ostatní. Po rozpoznané ztrátě relace lze požadavek pouze pro čtení jednou
zopakovat. Změna, jejíž odpověď se ztratila, se **nikdy neopakuje automaticky**.

Pokud obdržíte **`PROJECT_RECHECK_REQUIRED`**, změna nebyla provedena:

1. Znovu načtěte seznam aktuálních projektů a dotčené objekty.
2. Použijte výslovně uvedený klíč projektu a ověřte, že je cíl stále správný.
3. Zamýšlenou změnu vědomě zadejte znovu.

Rozhodující zůstávají oprávnění a potvrzení v ETS.

## Aktualizace a odebrání

### Nainstalujte aktualizaci

Komunitní balíčky se aktualizují ručně:

1. Nainstalujte novější balíček MCPB se stejnou technickou identitou `knx-mcp-claude`.
2. Ponechte vybrané platné profily v1.
3. Claude úplně ukončete, znovu spusťte a otevřete nový chat.
4. Znovu ověřte připojení a aktuální projekty.

Stejně restartujte po změně vybraných souborů, klíčů nebo důvěry v certifikáty.
Používejte nástroje načtené pro nový chat; nepřebírejte názvy ze staré historie
chatu.

### Změňte adresu nebo certifikát koncového bodu

Změnu ověřte v ETS, exportujte profil pod **novým názvem souboru** a nahraďte
starý výběr v Claude. Tiché změny identity na stejné cestě profilu se odmítají.

### Odeberte rozšíření

Odebráním rozšíření se profily ani certifikáty neodstraní.
Záznamy identity, které neobsahují tajné údaje, zůstávají také v
`%LOCALAPPDATA%/KNX-MCP/Claude/identities`. Jejich smazáním se odstraní dosavadní
historie rozpoznávání změn.

## Ochrana soukromí

Popisy, argumenty a výsledky nástrojů mohou obsahovat projektová nebo zákaznická
data. Výsledky se předávají Claude a může je zpracovávat jeho služba AI.
Celý tok dat proto není výhradně místní.

Klient nepoužívá zprostředkovací server vydavatele, telemetrii ani automatické
odesílání vydavateli. Chraňte profily, zálohy a protokoly a ujistěte se, že máte
oprávnění sdílet projektová data se službou AI.

Přečtěte si [Ochranu soukromí](PRIVACY.md) a [Informace o zabezpečení](SECURITY.md).

## Nápověda, zdrojové soubory a licence

| Téma | Dokument |
| --- | --- |
| Chyby nastavení a připojení | [Řešení potíží](TROUBLESHOOTING.md) |
| Dotazy a hlášení chyb | [Podpora](SUPPORT.md) |
| Soubory balíčku a kontrolní součty | [Průvodce distribucí](release/README.md) |
| Zahrnuté funkce | [Poznámky k verzi](release/CHANGELOG.md) |
| Sestavení, testy a export zdrojů | [Vývoj](DEVELOPMENT.md) |

Při hlášení chyby přiložte verze, kroky k jejímu zopakování a diagnostiku zbavenou
citlivých údajů. Nikdy nepřikládejte soukromé profily ani klíče.
Technické referenční dokumenty jsou v angličtině.

[Licence MIT](LICENSE.txt) se vztahuje na tohoto samostatného klienta a jeho
textovou dokumentaci. Proprietární aplikace ETS, Core a SDK mají samostatné
podmínky. Grafické značky podléhají [licenci grafických podkladů](assets/LICENSE.txt).

Verze a vydavatel jsou uvedeni v `manifest.json`; datum přípravy a referenční
verze aplikace ETS jsou v `release-info.json`. Sestavené balíčky obsahují otisk
zdrojů v `build-info.json` a samostatný soubor s kontrolním součtem SHA256.
