# KNX-MCP pour Claude Desktop

[English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Čeština](README.cs.md) · [Italiano](README.it.md) · [Русский](README.ru.md)

Connectez Claude Desktop à une ou plusieurs instances ETS5/ETS6 nommées sous
Windows. Chaque outil indique sa connexion cible. Vous pouvez ainsi travailler
avec plusieurs sites sans mélanger leurs sessions, clés d’accès ou paramètres
de confiance des certificats.

| En bref | Détails |
| --- | --- |
| Client | **1.0.4** |
| Paquet d’installation | `KNX-MCP-1.0.4.mcpb` |
| Version de référence de l’application ETS | KNX-MCP **1.2.0.4** et versions ultérieures compatibles |
| Plateforme | Claude Desktop sous Windows |
| Exécution | Node.js **22.16.0 ou ultérieur**, fourni par l’hôte |
| Éditeur | Gerald Docenko |
| Assistance | [support@knx-mcp.com](mailto:support@knx-mcp.com) |

Le client et l’application ETS ont des numéros de version indépendants.
Le client ne nécessite aucun paquet JavaScript tiers ni téléchargement de
paquets au démarrage.

## Prérequis

Avant l’installation, préparez les éléments suivants :

- Une installation **ETS5 ou ETS6** sous licence.
- L’**application ETS KNX-MCP**, installée séparément via MyKNX.
- **Claude Desktop sous Windows**, avec prise en charge des extensions MCPB.
- Un accès réseau depuis l’ordinateur de Claude vers chaque point de terminaison
  ETS souhaité.

Le fichier `.mcpb` installe l’extension Claude. Installez séparément l’application
ETS sur l’ordinateur exécutant ETS. Le comportement peut varier avec d’autres
hôtes ou modes d’exécution.

## Installation avec des profils exportés

### 1. Préparer ETS et exporter un profil

1. Ouvrez le projet souhaité dans ETS et démarrez son point de terminaison MCP
   dans le panneau KNX-MCP.
2. Dans les paramètres du serveur, section **HTTPS**, activez HTTPS, sélectionnez
   ou créez un certificat correspondant à l’adresse, puis appliquez les paramètres.
3. Dans **Claude One-Click-Installation KNX-MCP**, attribuez un nom explicite à la
   connexion et enregistrez `KNX-MCP-<name>.json` dans un dossier privé permanent.

Répétez ces étapes pour chaque point de terminaison ETS supplémentaire.

### 2. Installer l’extension dans Claude

1. Installez **`KNX-MCP-1.0.4.mcpb`** dans les paramètres des extensions de Claude.
2. Dans **Profils de connexion (recommandé)**, sélectionnez les profils exportés
   et enregistrez les paramètres. Vous pouvez sélectionner jusqu’à **32 profils**.
3. Quittez complètement Claude, y compris son processus dans la zone de
   notification, puis redémarrez-le.
4. Ouvrez une **nouvelle conversation** avec KNX-MCP activé.

Le [guide de distribution](release/README.md) explique les fichiers du paquet et
leurs sommes de contrôle.

### 3. Vérifier la connexion

1. Demandez à Claude d’appeler **`knx_connections`**.
2. Pour chaque connexion souhaitée, demandez l’exécution de **`ets_list_projects`**.
3. Vérifiez le serveur indiqué et le projet avant toute modification. Commencez
   avec le mode **Lecture seule** activé dans ETS.

### Conserver les profils dans un emplacement privé et stable

Les profils utilisent le format `knx-mcp-claude/v1` :

- Un profil contient une **clé d’accès en clair** et le certificat public du
  serveur. Il ne contient jamais la clé privée du certificat.
- La confiance dans le certificat s’applique uniquement à cette connexion.
  Aucune entrée de confiance n’est installée à l’échelle du système.
- Conservez les fichiers sélectionnés à leur emplacement enregistré. Après un
  déplacement ou un renommage, mettez à jour la sélection dans Claude et
  redémarrez-le complètement.

**Ne joignez jamais de profils à une conversation, à un ticket d’assistance ou
à un dépôt public.**

## Connexions multiples et noms des outils

Donnez un nom distinct à chaque connexion, par exemple `Office-ETS5` ou
`Office-ETS6`. Un outil associé à une connexion porte par exemple le nom
`Office-ETS6__ets_list_projects` ; son titre contient le nom complet de la connexion.

- Les caractères non pris en charge sont normalisés dans les noms techniques
  des outils.
- Les noms identiques ou longs peuvent recevoir un suffixe distinctif.
- Les connexions hors ligne conservent leur espace de noms. Un appel n’est jamais
  redirigé vers un autre site parce que le site souhaité est indisponible.

Le nom d’affichage est une étiquette, pas une preuve de la version ETS distante.
Vérifiez le serveur indiqué et le projet courant avant toute modification.

## Deux connexions manuelles facultatives

Vous pouvez utiliser des profils exportés, des connexions manuelles ou les deux.
Chaque connexion manuelle comporte trois champs :

| Champ | Valeur à saisir |
| --- | --- |
| **Nom** | Un nom de connexion clair et unique |
| **URL distante / locale** | Une adresse explicite, par exemple `https://ets-pc.example:51900/mcp` |
| **Jeton Bearer** | La clé d’accès seule, sans le mot `Bearer` |

**Renseignez les trois champs d’un bloc ou laissez-les tous vides.**
Ne configurez pas deux fois le même point de terminaison ; les entrées ambiguës
sont désactivées.

Si l’URL ne contient pas de chemin, `/mcp` est ajouté. `localhost` désigne
l’ordinateur exécutant Claude, qui peut être différent de celui exécutant ETS.

### HTTPS

Le certificat doit correspondre au nom d’hôte ou à l’adresse IP de l’URL et être
accepté par les sources de confiance Node/Windows prises en charge pour le
compte exécutant Claude.

Importez uniquement un certificat public vérifié ou utilisez un profil exporté.
L’extension ne modifie pas les magasins de certificats.

### HTTP pour des tests délibérés

Activez explicitement **Autoriser les connexions de test HTTP non chiffrées**,
même pour une adresse de boucle locale. HTTP transmet les clés d’accès et les
données du projet sans TLS ; réservez-le aux tests locaux ou autrement protégés
que vous avez délibérément choisis.

HTTPS ne bascule jamais silencieusement vers HTTP. Les redirections sont refusées.

## État et reprise de connexion

### Vérifier ou reconnecter une cible

| Outil local | Fonction |
| --- | --- |
| `knx_connections` | Afficher les versions du client et du serveur, l’état, le nombre d’outils et les erreurs de configuration, de transport ou d’appel |
| `knx_refresh_connections` | Relancer les connexions déjà chargées, éventuellement pour un seul identifiant `connection` |

L’état comprend aussi des identifiants de processus et des compteurs d’entrées
pour le diagnostic, sans chemins de profils ni identifiants secrets. Il représente
la **dernière observation**, pas une surveillance continue.

L’actualisation utilise la configuration déjà chargée par le client en cours
d’exécution. Après modification des paramètres enregistrés de l’hôte ou des
profils sélectionnés, redémarrez complètement Claude. L’actualisation ne recherche
pas de fichiers et ne recharge pas ces paramètres.

### Lorsque les outils apparaissent tardivement

Les cibles se chargent indépendamment. La première liste d’outils attend au plus
une seconde commune pour les catalogues déjà en cours de chargement ;
l’initialisation et l’état restent accessibles. Les catalogues disponibles plus
tard déclenchent des notifications de changement.

Si l’hôte ne recharge pas un catalogue reçu ultérieurement, redémarrez complètement
Claude une fois le point de terminaison ETS prêt.

### Après une perte de connexion ou de session

| Opération | Délai maximal |
| --- | --- |
| Établissement de la connexion | 15 secondes au total |
| Requête d’outil | 180 secondes |

Les appels sont exécutés en série pour chaque point de terminaison ; la file
d’attente d’un site ne bloque donc pas tous les sites. Après une perte de session
reconnue, une requête en lecture seule peut être réessayée une fois.
Une modification dont la réponse est perdue n’est **jamais rejouée automatiquement**.

Si vous recevez **`PROJECT_RECHECK_REQUIRED`**, la modification n’a pas été exécutée :

1. Relisez la liste des projets actuels et les objets concernés.
2. Utilisez une clé de projet explicite et vérifiez que la cible est toujours correcte.
3. Soumettez à nouveau la modification souhaitée de façon délibérée.

Les autorisations et confirmations ETS restent déterminantes.

## Mises à jour et suppression

### Installer une mise à jour

Les paquets communautaires se mettent à jour manuellement :

1. Installez le nouveau paquet MCPB conservant l’identité technique `knx-mcp-claude`.
2. Conservez la sélection de vos profils v1 valides.
3. Quittez complètement Claude, redémarrez-le, puis ouvrez une nouvelle conversation.
4. Vérifiez à nouveau la connexion et les projets actuels.

Redémarrez de la même manière après modification des fichiers sélectionnés, des
clés ou de la confiance dans les certificats. Utilisez les outils chargés pour la
nouvelle conversation ; ne reprenez pas les noms d’anciennes conversations.

### Changer l’adresse ou le certificat d’un point de terminaison

Vérifiez le changement dans ETS, exportez le profil sous un **nouveau nom de
fichier**, puis remplacez l’ancienne sélection dans Claude. Les changements
silencieux d’identité au même chemin de profil sont refusés.

### Supprimer l’extension

La suppression de l’extension laisse les profils et certificats en place.
Les marqueurs d’identité non secrets restent également sous
`%LOCALAPPDATA%/KNX-MCP/Claude/identities`. Leur suppression efface l’historique
précédent de détection des changements.

## Confidentialité

Les descriptions, arguments et résultats d’outils peuvent contenir des données
de projet ou de client. Les résultats sont transmis à Claude et peuvent être
traités par son service d’IA. L’ensemble du traitement n’est donc pas exclusivement
local.

Le client n’utilise aucun relais de l’éditeur, aucune télémétrie ni aucun envoi
automatique à l’éditeur. Protégez les profils, sauvegardes et journaux, et
assurez-vous de disposer de l’autorisation de partager les données du projet
avec le service d’IA.

Consultez la [politique de confidentialité](PRIVACY.md) et les
[informations de sécurité](SECURITY.md).

## Aide, sources et licence

| Sujet | Document |
| --- | --- |
| Erreurs de configuration et de connexion | [Dépannage](TROUBLESHOOTING.md) |
| Questions et signalements de bugs | [Assistance](SUPPORT.md) |
| Fichiers du paquet et sommes de contrôle | [Guide de distribution](release/README.md) |
| Fonctionnalités incluses | [Notes de version](release/CHANGELOG.md) |
| Création du paquet, tests et export des sources | [Développement](DEVELOPMENT.md) |

Pour signaler une erreur, indiquez les versions, les étapes de reproduction et
un diagnostic expurgé. Ne joignez jamais de profils privés ni de clés.
Les documents techniques de référence sont en anglais.

La [licence MIT](LICENSE.txt) couvre ce client indépendant et sa documentation
textuelle. L’application ETS propriétaire, son Core et le SDK sont soumis à
des conditions distinctes. Les éléments de marque sont couverts par la
[licence des ressources graphiques](assets/LICENSE.txt).

La version et l’éditeur figurent dans `manifest.json` ; la date de préparation et
la version ETS de référence figurent dans `release-info.json`. Les paquets générés
contiennent une empreinte des sources dans `build-info.json` et un fichier de
somme de contrôle SHA256 séparé.
