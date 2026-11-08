# KNX-MCP per Claude Desktop

[English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Čeština](README.cs.md) · [Italiano](README.it.md) · [Русский](README.ru.md)

Collegare Claude Desktop a una o più istanze ETS5/ETS6 con nomi distinti su Windows.
Ogni strumento indica la connessione di destinazione, consentendo di lavorare con
più sedi senza mescolare sessioni, credenziali o impostazioni di fiducia dei
certificati.

| In breve | Dettagli |
| --- | --- |
| Client | **1.0.4** |
| Pacchetto di installazione | `KNX-MCP-1.0.4.mcpb` |
| Versione ETS App di riferimento | KNX-MCP **1.2.0.4** e versioni successive compatibili |
| Piattaforma | Claude Desktop su Windows |
| Runtime | Node.js **22.16.0 o successivo**, fornito dall’applicazione host |
| Editore | Gerald Docenko |
| Assistenza | [support@knx-mcp.com](mailto:support@knx-mcp.com) |

Il client e l’applicazione ETS hanno numeri di versione indipendenti.
Il client non richiede pacchetti JavaScript di terze parti né download di
pacchetti all’avvio.

## Requisiti

Prima dell’installazione, predisporre:

- Un’installazione **ETS5 o ETS6** con licenza.
- L’**applicazione ETS KNX-MCP**, installata separatamente tramite MyKNX.
- **Claude Desktop su Windows** con supporto per le estensioni MCPB.
- L’accesso di rete dal computer con Claude a ogni endpoint ETS desiderato.

Il file `.mcpb` installa l’estensione Claude. Installare separatamente
l’applicazione ETS sul computer che esegue ETS. Altri host o modalità di
esecuzione possono comportarsi diversamente.

## Installazione con profili esportati

### 1. Preparare ETS ed esportare un profilo

1. Aprire il progetto desiderato in ETS e avviare il relativo endpoint MCP nel
   pannello KNX-MCP.
2. Nelle impostazioni del server, sezione **HTTPS**, abilitare HTTPS, scegliere o
   creare un certificato corrispondente all’indirizzo dell’endpoint e applicare
   le impostazioni.
3. In **Claude One-Click-Installation KNX-MCP**, assegnare un nome chiaro alla
   connessione e salvare `KNX-MCP-<name>.json` in una cartella privata permanente.

Ripetere questi passaggi per ogni ulteriore endpoint ETS da utilizzare.

### 2. Installare l’estensione in Claude

1. Installare **`KNX-MCP-1.0.4.mcpb`** nelle impostazioni delle estensioni di Claude.
2. In **Profili di connessione (consigliato)**, selezionare i profili esportati e
   salvare le impostazioni. È possibile selezionare fino a **32 profili**.
3. Chiudere completamente Claude, compreso il processo nell’area di notifica,
   e riavviarlo.
4. Aprire una **nuova chat** con KNX-MCP abilitato.

La [guida alla distribuzione](release/README.md) descrive i file del pacchetto e
le relative somme di controllo.

### 3. Verificare la connessione

1. Chiedere a Claude di chiamare **`knx_connections`**.
2. Per ogni connessione desiderata, richiedere l’esecuzione effettiva di
   **`ets_list_projects`**.
3. Verificare il server indicato e il progetto prima di apportare modifiche.
   Iniziare con **Sola lettura** abilitato in ETS.

### Conservare i profili in una posizione privata e stabile

I profili usano il formato `knx-mcp-claude/v1`:

- Un profilo contiene una **chiave di accesso in chiaro** e il certificato
  pubblico del server. Non contiene mai la chiave privata del certificato.
- La fiducia nel certificato vale solo per quella connessione. Non viene
  installata alcuna voce di fiducia a livello di sistema.
- Lasciare i file selezionati nei percorsi salvati. Dopo aver spostato o
  rinominato un file, aggiornare la selezione in Claude e riavviarlo completamente.

**Non caricare mai profili in chat, ticket di assistenza o repository pubblici.**

## Connessioni multiple e nomi degli strumenti

Assegnare a ogni connessione un nome distinto, ad esempio `Office-ETS5` o
`Office-ETS6`. Uno strumento associato a una connessione può chiamarsi
`Office-ETS6__ets_list_projects`; il titolo visualizzato include il nome completo
della connessione.

- I caratteri non supportati vengono normalizzati nei nomi tecnici degli strumenti.
- I nomi duplicati o lunghi possono ricevere un suffisso distintivo.
- Le connessioni offline mantengono il proprio spazio dei nomi. Una chiamata non
  viene mai reindirizzata a un’altra sede quando quella desiderata non è disponibile.

Il nome visualizzato è un’etichetta, non una prova della versione ETS remota.
Verificare il server indicato e il progetto corrente prima delle modifiche.

## Due connessioni manuali facoltative

È possibile utilizzare profili esportati, connessioni manuali o entrambi.
Ogni connessione manuale contiene tre campi:

| Campo | Valore da inserire |
| --- | --- |
| **Nome** | Un nome di connessione chiaro e univoco |
| **Remote / Local URL** | Un indirizzo esplicito, ad esempio `https://ets-pc.example:51900/mcp` |
| **Bearer token** | La sola chiave di accesso, senza la parola `Bearer` |

**Compilare tutti e tre i campi di un blocco oppure lasciarli tutti vuoti.**
Non configurare due volte lo stesso endpoint; le voci ambigue vengono disabilitate.

Se l’URL non contiene un percorso, viene aggiunto `/mcp`. `localhost` indica il
computer che esegue Claude, che può essere diverso da quello che esegue ETS.

### HTTPS

Il certificato deve corrispondere al nome host o all’indirizzo IP dell’URL ed
essere considerato attendibile dalle fonti di fiducia Node/Windows supportate
per l’account che esegue Claude.

Importare solo un certificato pubblico verificato oppure utilizzare un profilo
esportato. L’estensione non modifica gli archivi dei certificati.

### HTTP per test intenzionali

Abilitare esplicitamente **Consenti HTTP non cifrato per le connessioni di prova**,
anche per il loopback. HTTP trasmette chiavi di accesso e dati del progetto senza
TLS; usarlo soltanto per test locali o altrimenti protetti scelti consapevolmente.

HTTPS non passa mai automaticamente a HTTP. I reindirizzamenti vengono rifiutati.

## Stato e ripristino della connessione

### Verificare o riconnettere una destinazione

| Strumento locale | Funzione |
| --- | --- |
| `knx_connections` | Mostrare versioni di client/server, stato, numero di strumenti ed errori di configurazione, trasporto o chiamata |
| `knx_refresh_connections` | Riconnettere le destinazioni già caricate, eventualmente un solo identificatore `connection` |

Lo stato include anche identificatori di processo e conteggi degli input ricevuti
per la diagnostica, senza percorsi dei profili o credenziali. Rappresenta
l’**ultima osservazione**, non un monitoraggio continuo.

L’aggiornamento delle connessioni usa la configurazione già caricata dal client
in esecuzione. Dopo aver modificato le impostazioni salvate dell’host o i profili
selezionati, riavviare completamente Claude. L’aggiornamento non cerca file e non
ricarica quelle impostazioni.

### Quando gli strumenti compaiono in ritardo

Le destinazioni si caricano indipendentemente. La prima lista degli strumenti
attende al massimo un secondo complessivo per i cataloghi già in caricamento;
inizializzazione e stato rimangono disponibili. I cataloghi successivi generano
notifiche di modifica.

Se l’host non ricarica un catalogo arrivato in seguito, riavviare completamente
Claude quando l’endpoint ETS è pronto.

### Dopo una perdita di connessione o di sessione

| Operazione | Limite di tempo |
| --- | --- |
| Connessione iniziale | 15 secondi in totale |
| Richiesta a uno strumento | 180 secondi |

Le chiamate vengono eseguite in sequenza per ogni endpoint, quindi la coda di una
sede non blocca tutte le altre. Dopo una perdita di sessione riconosciuta, una
richiesta di sola lettura può essere ritentata una volta.
Una modifica la cui risposta è andata persa non viene **mai ripetuta automaticamente**.

Se si riceve **`PROJECT_RECHECK_REQUIRED`**, la modifica non è stata eseguita:

1. Rileggere l’elenco dei progetti correnti e gli oggetti interessati.
2. Usare una chiave di progetto esplicita e verificare che la destinazione sia
   ancora corretta.
3. Inviare nuovamente la modifica desiderata in modo intenzionale.

Le autorizzazioni e le conferme di ETS restano determinanti.

## Aggiornamenti e rimozione

### Installare un aggiornamento

I pacchetti della Community si aggiornano manualmente:

1. Installare il pacchetto MCPB più recente con la stessa identità tecnica `knx-mcp-claude`.
2. Mantenere selezionati i profili v1 validi.
3. Chiudere completamente Claude, riavviarlo e aprire una nuova chat.
4. Verificare nuovamente la connessione e i progetti correnti.

Riavviare nello stesso modo dopo aver modificato i file selezionati, le chiavi o
la fiducia nei certificati. Usare gli strumenti caricati per la nuova chat;
non riutilizzare nomi provenienti dalla cronologia di vecchie chat.

### Cambiare l’indirizzo o il certificato di un endpoint

Verificare la modifica in ETS, esportare il profilo con un **nuovo nome di file**
e sostituire la vecchia selezione in Claude. I cambiamenti silenziosi di identità
nello stesso percorso del profilo vengono rifiutati.

### Rimuovere l’estensione

La rimozione dell’estensione lascia intatti i file dei profili e i certificati.
Rimangono anche i record di identità non segreti in
`%LOCALAPPDATA%/KNX-MCP/Claude/identities`. La loro eliminazione rimuove la
precedente cronologia di rilevamento dei cambiamenti.

## Privacy

Descrizioni, argomenti e risultati degli strumenti possono contenere dati di
progetto o del cliente. I risultati vengono passati a Claude e possono essere
elaborati dal suo servizio di IA. L’intero flusso non è quindi esclusivamente
locale.

Il client non usa un relay dell’editore, telemetria o invii automatici all’editore.
Proteggere profili, backup e log e assicurarsi di essere autorizzati a condividere
i dati del progetto con il servizio di IA.

Leggere l’[informativa sulla privacy](PRIVACY.md) e le
[informazioni sulla sicurezza](SECURITY.md).

## Aiuto, sorgenti e licenza

| Argomento | Documento |
| --- | --- |
| Errori di configurazione e connessione | [Risoluzione dei problemi](TROUBLESHOOTING.md) |
| Domande e segnalazioni di bug | [Assistenza](SUPPORT.md) |
| File del pacchetto e somme di controllo | [Guida alla distribuzione](release/README.md) |
| Funzionalità incluse | [Note di versione](release/CHANGELOG.md) |
| Creazione del pacchetto, test ed esportazione dei sorgenti | [Sviluppo](DEVELOPMENT.md) |

Nelle segnalazioni di errore includere le versioni, i passaggi per riprodurlo e
la diagnostica priva di dati riservati. Non includere mai profili privati o chiavi.
La documentazione tecnica di riferimento è in inglese.

La [licenza MIT](LICENSE.txt) copre questo client indipendente e la sua
documentazione testuale. L’applicazione ETS proprietaria, il Core e l’SDK hanno
condizioni separate. Gli elementi del marchio sono soggetti alla
[licenza delle risorse grafiche](assets/LICENSE.txt).

Versione ed editore sono registrati in `manifest.json`; la data di preparazione
e la versione ETS App di riferimento sono in `release-info.json`. I pacchetti
generati includono un’impronta dei sorgenti in `build-info.json` e un file separato
con la somma di controllo SHA256.
