# Rapport de Projet de Fin d'Etudes

## Plateforme omnicanale d'assistance operationnelle et de gestion des connaissances : conception et realisation de Focal V3

**Realise par :** Abdelfattah AZELMADI  
**Cycle :** Cycle d'ingenieur  
**Annee universitaire :** 2025 - 2026  
**Etablissement :** Institut Superieur de Management d'Administration et de Genie Informatique - ISMAGI  
**Projet :** Focal V3  
**Version du rapport :** 1.0

# Resume

Ce projet de fin d'etudes porte sur la conception et la realisation de **Focal V3**, une plateforme web destinee aux equipes de support client, de connaissance, de qualite, de formation et d'operations. Le projet repond a une problematique frequente dans les fintechs et neobanques en phase de croissance : centraliser les outils d'assistance, reduire le temps de traitement des demandes, uniformiser les reponses, fiabiliser les processus internes et donner aux responsables une visibilite exploitable sur la performance operationnelle.

Focal V3 regroupe plusieurs briques metier dans une interface unique : CRM email, base de connaissance, arbres de decision, cartes SOP, assistant IA oriente processus, collaboration interne, live chat public, calendrier, gestion des formations, tableaux de bord qualite, suivi d'adherence, gestion des droits, escalade L1/L2 et integration Jira. L'application est developpee avec une architecture full stack moderne : **Angular 21** cote frontend, **Spring Boot 4** cote backend, **MySQL/MariaDB** pour la persistance, authentification JWT, API REST, WebSockets, integrations externes et deploiement Docker.

Le travail realise couvre l'analyse fonctionnelle, la conception UX/UI, la modelisation de donnees, la securite applicative, l'implementation des modules, l'integration d'APIs externes et la preparation au deploiement. La version V3 constitue le coeur stable du produit : elle impose une navigation structuree, une gestion fine des acces par role, des modules independants mais coherents, et une experience utilisateur pensee pour des environnements de support a forte cadence.

**Mots cles :** CRM, support client, fintech, Angular, Spring Boot, MySQL, JWT, WebSocket, base de connaissance, workflow, IA, qualite, formation, Jira, Docker.

# Abstract

This final-year engineering project presents the design and implementation of **Focal V3**, a full stack operational assistance platform for customer support teams, knowledge managers, quality analysts, trainers and supervisors. The system centralizes email CRM, knowledge management, decision trees, SOP maps, AI-powered process assistance, internal collaboration, public live chat, training, analytics, role-based access control and L1/L2 escalation workflows. The solution is built with Angular 21, Spring Boot 4, MySQL/MariaDB, JWT security, REST APIs, WebSockets and Docker-based deployment. The project focuses on productivity, operational consistency, scalability and usability for fintech and neobank support environments.

# Remerciements

Je tiens a remercier l'Institut Superieur de Management d'Administration et de Genie Informatique pour le cadre academique fourni durant mon cycle d'ingenieur. Je remercie egalement les enseignants, encadrants et professionnels qui ont contribue directement ou indirectement au developpement de mes competences en analyse, conception logicielle, architecture web et gestion de projet.

Ce projet represente une etape importante dans ma progression : il m'a permis de passer d'une logique d'execution technique a une logique de produit complet, combinant besoins metier, experience utilisateur, architecture logicielle, securite, deploiement et valeur operationnelle.

# Sommaire

1. Introduction generale
2. Contexte et problematique
3. Presentation generale de Focal V3
4. Etude fonctionnelle
5. Architecture technique
6. Conception UX/UI et charte graphique
7. Modelisation de donnees
8. Realisation des modules V3
9. Securite, roles et controle d'acces
10. Integrations externes et IA
11. Deploiement et exploitation
12. Tests, validation et qualite
13. Limites et perspectives
14. Conclusion generale
15. Annexes

# Liste des abreviations

| Abreviation | Signification |
|---|---|
| API | Application Programming Interface |
| CRM | Customer Relationship Management |
| CSAT | Customer Satisfaction Score |
| DTO | Data Transfer Object |
| IA | Intelligence Artificielle |
| IMAP | Internet Message Access Protocol |
| JWT | JSON Web Token |
| KB | Knowledge Base, base de connaissance |
| KPI | Key Performance Indicator |
| L1 / L2 | Niveau 1 / Niveau 2 de support |
| OAuth | Open Authorization |
| PFE | Projet de Fin d'Etudes |
| QA | Quality Assurance |
| REST | Representational State Transfer |
| SOP | Standard Operating Procedure |
| SSO | Single Sign-On |
| UI / UX | User Interface / User Experience |
| WebSocket | Protocole de communication temps reel |

# 1. Introduction generale

La digitalisation des services financiers a profondement transforme les exigences en matiere de support client. Une fintech ou une neobanque ne peut plus se limiter a repondre aux demandes entrantes : elle doit garantir des reponses rapides, coherentes, tracables et conformes aux procedures internes. Les agents doivent acceder instantanement aux bonnes informations, les superviseurs doivent mesurer l'activite en temps reel, les equipes qualite doivent evaluer les interactions, et les equipes operationnelles doivent ameliorer les processus continuellement.

Dans ce contexte, le projet Focal V3 a ete concu comme une plateforme interne complete. L'objectif n'est pas uniquement de creer un CRM ou une base documentaire, mais de reunir plusieurs fonctions critiques dans un meme environnement : assistance, connaissance, collaboration, automatisation, formation, pilotage et escalade. La version V3 correspond au tableau de bord principal du produit et constitue la base fonctionnelle sur laquelle peut etre construit un systeme SaaS ou auto-heberge.

Le projet s'inscrit dans une demarche d'ingenierie complete : analyse des besoins, choix technologiques, modelisation, developpement frontend et backend, securisation des acces, integrations externes, deploiement et reflexion sur les evolutions futures. Le rapport presente les choix realises, la structure de la solution et la valeur metier apportee.

# 2. Contexte et problematique

## 2.1 Contexte metier

Les equipes de support dans les fintechs et neobanques traitent generalement plusieurs types de demandes : identification client, verification KYC, paiement, remboursement, probleme de compte, demande de pret, blocage d'acces, reclamation ou escalade technique. Ces demandes necessitent souvent une reponse rapide, mais aussi une forte rigueur, car elles peuvent toucher des donnees sensibles et des processus reglementes.

L'environnement operationnel impose plusieurs contraintes : les agents doivent suivre des procedures precises, les reponses doivent rester homogenes entre agents, les tickets doivent pouvoir etre escalades, les superviseurs doivent suivre l'adherence et la productivite, et les nouvelles recrues doivent etre formees rapidement. En l'absence d'un outil centralise, les equipes utilisent souvent plusieurs outils separes : messagerie, tableurs, documents, chat interne, outil de ticketing, base documentaire et outils de formation. Cette fragmentation augmente les erreurs et ralentit les operations.

## 2.2 Problematique

La problematique principale peut etre formulee ainsi : **comment concevoir une plateforme centralisee capable d'ameliorer la productivite du support client tout en garantissant la qualite, la tracabilite, la coherence des reponses et l'adaptabilite aux processus internes d'une fintech ?**

Cette problematique se decline en plusieurs questions :

- Comment donner aux agents un acces rapide a la connaissance utile ?
- Comment guider les agents dans des procedures complexes ?
- Comment permettre aux responsables de suivre les performances ?
- Comment gerer les droits d'acces selon les roles ?
- Comment integrer les canaux de communication client ?
- Comment preparer le produit a une exploitation reelle et scalable ?
- Comment ajouter l'IA de maniere controlee et utile au contexte metier ?

## 2.3 Objectifs du projet

Le projet vise a construire une plateforme operationnelle avec les objectifs suivants : centraliser les outils de support, reduire le temps moyen de traitement, ameliorer la qualite des reponses, suivre l'activite des agents, permettre l'escalade structuree des cas, integrer l'assistance IA et rendre la plateforme extensible.

| Objectif | Traduction dans Focal V3 |
|---|---|
| Centralisation | V3 Shell avec navigation unique et modules metier integres |
| Productivite | CRM, base de connaissance, Magic Assistance, recherche globale |
| Qualite | QA Evaluation, feedback article, SOP maps, controle de coherence |
| Pilotage | KB Analytics, adherence, dashboards, logs de statuts |
| Collaboration | Collaboration Hub, mentions, canaux, notifications |
| Automatisation | Process Assistant, workflow builders, live chat, routage |
| Securite | JWT, roles, feature access map, API backend |
| Scalabilite | Architecture modulaire Angular/Spring Boot/MySQL/Docker |

# 3. Presentation generale de Focal V3

Focal V3 est la version principale de la plateforme. Elle est accessible via la route `/v3` et repose sur une structure de shell applicatif : une barre laterale de navigation, une barre superieure de controle et une zone centrale dediee aux pages metier. Ce choix permet d'offrir une experience coherente entre les modules tout en gardant chaque fonctionnalite independante.

La plateforme est concue comme un systeme modulaire. Chaque module repond a un besoin operationnel precis, mais l'ensemble forme un ecosysteme coherent. Par exemple, la base de connaissance alimente les agents, les cartes SOP structurent les procedures, l'assistant IA utilise des profils de prompt par role, la collaboration interne permet de partager des articles, et les dashboards permettent de mesurer l'utilisation reelle de la connaissance.

## 3.1 Modules principaux de V3

| Module V3 | Role fonctionnel |
|---|---|
| Command Center | Page d'accueil operationnelle donnant acces aux fonctions cles |
| CRM Inbox | Traitement des emails, tickets, notes internes, tags et historique client |
| Knowledge Base | Consultation d'articles, recherche, liens rapides, cartes SOP et feedback |
| KB Analytics | Suivi du temps passe par agent et par article, vues, usage et tendances |
| Magic Assistance | Arbres de decision pour guider les agents dans les procedures |
| Process Assistant | Assistant IA avec historique de conversations et prompts par role |
| Collaboration Hub | Messagerie interne, canaux, mentions, reactions et partage de ressources |
| Chat Projects | Creation de chatbots publics par projet avec workflows et files d'attente |
| Live Chat | Interface agent pour gerer les conversations clients en temps reel |
| Academy | Formation des agents, catalogue, studio, videos, certificats et analytics |
| Calendar | Organisation d'evenements et planification d'equipe |
| FlowDesk | Gestion de backlog, sprints, reports et escalades operationnelles |
| QA Evaluation | Evaluation qualitative des tickets et suivi par agent |
| Adherence Dashboard | Suivi des statuts agents et timeline d'adherence |
| Staff Management | Creation, activation, desactivation et administration des comptes |
| Role Access Map | Gestion visuelle des acces par role et par fonctionnalite |
| Settings | Parametres utilisateur, profil, timezone, preferences et integrations |

## 3.2 Acteurs du systeme

La plateforme prend en compte plusieurs profils : agents, team leaders, QA, administrateurs, responsables operations, L1, L2 et utilisateurs publics pour le chat. Les permissions ne sont pas seulement des roles figes : elles peuvent etre liees a des fonctionnalites via une carte d'acces, ce qui permet d'adapter l'outil a l'organisation reelle.

| Acteur | Besoins principaux |
|---|---|
| Agent | Traiter les demandes, consulter la KB, utiliser Magic Assistance, acceder aux formations |
| Team Leader | Suivre l'equipe, consulter adherence, tickets et performance |
| QA | Evaluer les cas, acceder aux tickets necessaires, produire des feedbacks |
| Admin | Gerer comptes, roles, acces, builders, configurations et donnees maitres |
| Head of CS / OPS | Vision globale des operations, acces builders, analytics, management |
| L1 | Creer des tickets d'escalade et suivre ses demandes |
| L2 | Prendre en charge les tickets escalades, commenter, mettre a jour et creer des tickets Jira |
| Client final | Utiliser le chat public sans acces aux outils internes |

# 4. Etude fonctionnelle

## 4.1 Besoins fonctionnels

Les besoins fonctionnels couvrent l'ensemble du cycle operationnel : information, action, controle et amelioration. La plateforme ne se limite pas a l'affichage d'informations, elle structure les workflows de travail.

| Besoin | Realisation dans V3 |
|---|---|
| Authentification securisee | Login, JWT, controle d'acces backend/frontend |
| Gestion des comptes | Staff Management, statut actif/desactive, roles |
| Gestion des droits | Role Access Map, feature catalog, RoleGuard |
| Consultation documentaire | Knowledge Base avec categories, articles, recherche |
| Procedures visuelles | KB Map Builder et Tree Builder inspires des maps |
| Guidage agent | Magic Assistance avec choix, pages et processus |
| Email CRM | Gmail OAuth, threads, reponses, pieces jointes, notes internes |
| Classification tickets | Case Tag Builder, tags hierarchiques et typologies |
| Suivi qualite | QA Evaluation et acces cible aux cas |
| Formation | Academy, Catalog, Studio, Analytics, certificats |
| Collaboration | Channels, messages, mentions, reactions, unread counts |
| Chat public | Chat Projects, public chat, CSAT, live chat agent |
| Escalade | FlowDesk Escalations, L1/L2, Jira Bridge |
| Pilotage | KB Analytics, Adherence, reports |
| Parametrage | User Settings, profil, langue, timezone, integrations |

## 4.2 Besoins non fonctionnels

Les besoins non fonctionnels sont essentiels dans un environnement professionnel. Le systeme doit rester maintenable, securise, extensible et utilisable par plusieurs profils.

| Critere | Exigence retenue |
|---|---|
| Securite | Authentification JWT, controle serveur, API protegees, roles |
| Performance | Lazy loading Angular, optimisation production, SSR possible |
| Maintenabilite | Architecture par composants/services, backend par controllers/services/repositories |
| Tracabilite | Tables de logs, historiques, tracking KB, statuts et messages |
| Extensibilite | Modules decouples, builders, API REST, WebSocket, integrations futures |
| Disponibilite | Dockerisation, separation frontend/backend/DB, preparation au cloud |
| Ergonomie | Interface V3 coherente, navigation stable, animations limitees au contenu |
| Scalabilite | Base relationnelle, services metier, possibilite de migration vers Kubernetes |

## 4.3 Regles metier importantes

Plusieurs regles metier structurent le fonctionnement du produit. Un compte desactive ne doit plus acceder aux fonctionnalites. Les agents ne doivent voir que les modules autorises. Les acces non lies dans la carte de role ne doivent pas etre visibles. Le contenu sensible, comme le CRM ou les tickets, doit rester limite aux profils habilites. Les sessions de live chat doivent etre isolees par projet. Les tickets L2 ne doivent pas etre pris par deux agents en meme temps. Les workflows publies doivent etre coherents avant usage.

# 5. Architecture technique

## 5.1 Vue globale

Focal V3 repose sur une architecture full stack composee d'un frontend Angular, d'un backend Spring Boot et d'une base de donnees MySQL/MariaDB. La communication principale se fait par API REST. Les fonctionnalites temps reel utilisent WebSocket lorsque necessaire, notamment pour le live chat et la collaboration.

| Couche | Technologie | Responsabilite |
|---|---|---|
| Presentation | Angular 21 | UI, routing, composants, services HTTP, animations |
| Shell V3 | Angular components | Navigation, topbar, layout, controles globaux |
| API | Spring Boot 4 | Controllers REST, securite, logique metier |
| Temps reel | Spring WebSocket | Messages, typing, affectations, notifications |
| Persistance | MySQL/MariaDB + JPA | Stockage relationnel, entites metier, historiques |
| Securite | Spring Security + JWT | Authentification, filtres, role utilisateur |
| Integrations | Gmail, OpenAI, Jira, Meta-ready | Services externes connectes par backend |
| Deploiement | Docker / Docker Compose | Packaging, execution, isolation des services |

## 5.2 Flux d'architecture

Le flux principal suit une separation claire : l'utilisateur interagit avec l'interface Angular, Angular appelle les endpoints Spring Boot, le backend applique la securite et la logique metier, puis persiste les donnees dans MySQL. Les API externes ne sont pas appelees directement par le navigateur lorsqu'elles necessitent des secrets ; elles doivent passer par le backend afin d'eviter l'exposition de tokens, cles ou identifiants.

Architecture logique :

- Utilisateur interne -> V3 Shell Angular -> Services Angular -> API Spring Boot -> Services backend -> Repositories JPA -> MySQL/MariaDB.
- Client public chat -> Page publique `/chat/:slug` -> API publique projet -> workflow engine -> live chat / WebSocket -> agent interne.
- Integrations externes -> Gmail/Jira/OpenAI/Meta -> services backend dedies -> base de donnees et frontend.

## 5.3 Frontend Angular

Le frontend est organise autour de composants standalone, de routes lazy-loaded et de services specialises. Le fichier de routes montre que V3 est le tableau de bord principal, tandis que les anciennes routes sont redirigees vers V3 pour garantir une experience unifiee.

Le shell V3 contient : sidebar, topbar, recherche, selection de langue, timezone, statut agent, photo de profil, badge de messages non lus, transition de contenu et controle d'acces par feature. Cette approche donne une structure stable a l'application et evite que chaque module reinvente sa navigation.

## 5.4 Backend Spring Boot

Le backend est structure en controllers REST, services, repositories et modeles JPA. Les endpoints sont regroupes par domaine metier : authentification, connaissance, CRM, Gmail, access control, staff, collaboration, chat projects, live chat, process assistant, training, Jira, escalation, etc.

Cette separation permet d'isoler la logique metier. Par exemple, la Knowledge Base possede ses controllers et services propres, le live chat dispose de modeles de projet, queue, session et message, et l'assistant IA possede ses conversations, messages et prompt profiles.

## 5.5 Base de donnees

La base de donnees contient des tables metier pour les utilisateurs, roles, articles, maps, CRM, messages, formations, prompts, chat, escalades et historiques. Le backend utilise JPA avec mise a jour automatique du schema en developpement. Pour une production stricte, il est recommande de passer vers des migrations versionnees comme Flyway ou Liquibase.

# 6. Conception UX/UI et charte graphique

## 6.1 Orientation graphique ISMAGI

La page de garde fournie et la charte graphique ISMAGI orientent le document vers une identite academique claire : bleu fonce pour la structure et la confiance, turquoise pour l'accent technologique, typographies sobres de type Arial/Calibri, hierarchie visuelle nette et presentation professionnelle.

Dans ce rapport, ces choix sont appliques de maniere coherente : titres en bleu, accents turquoise, tableaux structures, redaction formelle, mise en page aeree et vocabulaire technique maitrise. Le but est de produire un document universitaire serieux tout en refletant le caractere produit et moderne de Focal V3.

## 6.2 Design produit V3

Le design V3 est pense comme un cockpit operationnel. La sidebar classe les modules par sections : Workspace, Academy, Build, Manage et Delivery. La topbar regroupe les actions globales : recherche rapide, langue, timezone, statut, notifications et sortie. Cette separation reduit la charge cognitive : la navigation structure les domaines, tandis que la topbar gere le contexte utilisateur.

La plateforme utilise des cartes, panneaux, builders visuels, canvas avec grille, connecteurs et inspecteurs lateraux. Cette logique est particulierement visible dans les builders : Tree Builder, KB Map Builder, Prompt Map Builder, Role Access Map et Chat Workflow Builder. Le meme langage visuel rend les outils complexes plus comprehensibles.

## 6.3 Principes UX retenus

| Principe | Application |
|---|---|
| Coherence | Meme shell, memes controles, memes patterns de navigation |
| Clarte | Chaque module a une fonction identifiable et une route dediee |
| Productivite | Recherche globale, shortcuts, cartes, listes filtrables |
| Feedback utilisateur | Toasts, loaders, animations de contenu, confirmations |
| Controle | Parametres utilisateur, role, acces, timezone, statut |
| Reduction du bruit | Animations limitees au contenu, pas a la navigation permanente |
| Scalabilite UX | Builders visuels reutilisables pour maps, roles, prompts et workflows |

# 7. Modelisation de donnees

## 7.1 Familles d'entites

La base de donnees est structuree par domaines fonctionnels. Les entites refletent l'approche modulaire du produit.

| Domaine | Exemples d'entites |
|---|---|
| Utilisateurs et acces | User, RoleAccessProfile, RoleAccessLink, UserSettings |
| Presence et adherence | UserStatus, UserStatusHistory |
| Knowledge Base | KbCategory, KbArticle, KbMapNode, KbMapEdge, KbArticleTimeLog |
| Magic Assistance | Page, Choice |
| CRM | CemConversation, CemContact, CemInternalNote, CaseTagNode, CaseTagEdge |
| Gmail | GmailAccount |
| Collaboration | CollaborationRoom, CollaborationRoomMember, CollaborationMessage, Mentions, Reactions |
| Live Chat | ChatProject, ChatQueue, ChatQueueAgent, LiveChatSession, LiveChatMessage |
| Process Assistant | ProcessAssistantConversation, ProcessAssistantMessage, PromptProfile, PromptRoleLink |
| Training | TrainingAsset et structures associees aux cours |
| Escalation | EscalationTicket, EscalationComment |
| QA | QaEvaluation |
| Jira | Donnees de liaison ticket/Jira dans les tickets d'escalade |

## 7.2 Exemple de logique relationnelle

Une relation typique est la Knowledge Base : une categorie possede plusieurs articles, un article peut posseder une carte SOP composee de noeuds et d'aretes, les vues sont enregistrees dans les logs, et les feedbacks sont lies a l'article et a l'utilisateur. Cette structure permet de passer d'un simple contenu statique a une connaissance exploitable : suivi, feedback, amelioration et decision.

## 7.3 Isolation des projets live chat

Dans le module Chat Projects, chaque projet possede ses workflows, queues, agents, sessions et cles API. Cette isolation est importante pour rendre le systeme compatible avec plusieurs cas d'usage : differents sites, differents produits, differentes equipes ou differents clients.

# 8. Realisation des modules V3

## 8.1 Command Center

Le Command Center sert de point d'entree. Il presente les acces rapides vers les modules critiques et adapte l'affichage selon les droits de l'utilisateur. Il donne une vision claire de l'ecosysteme : CRM, base de connaissance, Magic Assistance, collaboration, live chat, formation, FlowDesk et administration.

## 8.2 Knowledge Base

La Knowledge Base est un module central. Elle permet de consulter des articles organises par categories, de rechercher rapidement un contenu, de copier un lien, d'afficher une carte SOP associee et de donner un feedback. La carte article est en mode lecture : seuls les noeuds contenant du contenu detaille sont cliquables, ce qui evite de creer de la confusion entre navigation et information.

Le module inclut aussi un suivi analytique du temps passe par agent et par article. Cette donnee est precieuse pour les superviseurs : elle montre quels articles sont consultes, quels sujets demandent beaucoup de temps, quelles equipes utilisent reellement la documentation et ou ameliorer la base de connaissance.

## 8.3 KB Analytics

KB Analytics transforme les consultations en donnees decisionnelles. Le dashboard affiche les heures totales, les utilisateurs uniques, les articles consultes, les evenements suivis, les moyennes par article et par utilisateur. Les responsables peuvent analyser les articles les plus utilises, les agents les plus actifs et les vues recentes.

Ce module apporte une dimension strategique : une base de connaissance n'est plus seulement un referentiel, mais un outil mesurable d'amelioration continue.

## 8.4 Magic Assistance

Magic Assistance guide les agents a travers des arbres de decision. Chaque choix mene a une page ou une etape. L'objectif est d'eviter les reponses improvisees et de rendre les processus complexes plus simples pour les agents. Ce module est particulierement utile pour les cas reglementes, comme KYC, blocage de compte, pret, remboursement ou verification d'identite.

## 8.5 Builders visuels

Les builders visuels sont une force du projet. Ils permettent aux administrateurs de construire des arbres ou cartes sans modifier le code. Le Tree Builder, le KB Map Builder, le Case Tag Builder, le Prompt Map Builder et le Role Access Map utilisent une logique de carte : noeuds, connexions, canvas, pan, zoom et panneau de configuration.

Cette approche rend l'outil adaptable. Une entreprise peut modifier ses procedures, ses typologies ou ses acces sans demander un developpement technique a chaque changement.

## 8.6 CRM Inbox

Le CRM Inbox centralise la gestion des emails et tickets. Il gere les conversations, l'historique, les reponses, les notes internes, les pieces jointes, la synchronisation Gmail, les tags de cas, les statuts et les files. Il permet egalement de differencier les messages clients, les reponses support et les notes internes.

La separation entre email envoye et note interne est essentielle : elle permet a l'agent de documenter un dossier sans exposer l'information au client. Les pieces jointes peuvent etre previsualisees et telechargees. Les tags hierarchiques permettent de classifier les demandes.

## 8.7 Collaboration Hub

Collaboration Hub fournit une messagerie interne type Slack : canaux, messages directs, reactions, mentions, notifications et liens avec les ressources. L'objectif est d'eviter que les discussions operationnelles soient dispersees dans des outils externes non maitrises.

Le module tient compte des acces : certains canaux peuvent etre reserves, et l'administration peut gerer l'appartenance via une logique visuelle de mapping. Le badge de messages non lus dans le shell V3 ameliore la reactivite.

## 8.8 Chat Projects et Live Chat

Chat Projects permet de creer des chatbots publics par projet. Chaque projet possede un slug public, une URL `/chat/:slug`, des cles API, des queues, des agents et un workflow. Le public chat est separe du V3 Shell et ne necessite pas d'authentification.

Live Chat donne aux agents la possibilite de gerer les conversations en temps reel. Les sessions peuvent passer d'un bot a un agent selon les regles de workflow. Le systeme est concu pour evoluer vers WhatsApp, Instagram, Messenger, web widgets ou autres canaux.

## 8.9 Process Assistant

Process Assistant est un assistant IA interne. Il permet a chaque utilisateur de creer des conversations, de poser des questions sur les processus, et d'utiliser des profils de prompt adaptes aux roles. Les administrateurs peuvent gerer les prompts et les lier aux roles via un prompt map builder.

L'integration de l'IA est controlee : l'objectif n'est pas de laisser l'IA repondre librement aux clients, mais d'assister l'agent dans sa comprehension des processus, la formulation, la synthese et la recherche d'information.

## 8.10 Academy

Academy regroupe la formation des agents. Elle comprend My Trainings, Catalog, Studio et Analytics. Les agents peuvent suivre des cours, consulter du contenu, visionner des videos, obtenir des certificats et progresser. Les responsables peuvent creer les formations, suivre le temps passe par etape et analyser l'avancement.

## 8.11 QA Evaluation et Adherence

QA Evaluation permet aux profils qualite d'evaluer les cas par agent. Les resultats peuvent etre visibles par les agents et team leaders selon les regles d'acces. L'Adherence Dashboard suit les statuts agents sous forme de timeline : online, away, wrap-up, offline, etc. Ces modules apportent une couche de controle qualite et de management operationnel.

## 8.12 FlowDesk et escalade L1/L2

FlowDesk couvre la logique de delivery : backlog, sprints, reports et escalades. Le module d'escalade permet aux agents L1 de creer des tickets pour L2, de renseigner un client ID, plusieurs types de problemes, une priorite et des details. Les L2 disposent d'une playlist de tickets, peuvent prendre en charge le plus ancien ticket disponible, commenter, changer le statut et creer un ticket Jira si necessaire.

La logique attendue est proche d'un outil de ticketing professionnel : eviter les doublons, lier un ticket duplicat a un original, empecher deux L2 de prendre le meme ticket, refuser la resolution si le ticket Jira lie n'est pas resolu, et garder un historique visible.

# 9. Securite, roles et controle d'acces

## 9.1 Authentification

L'authentification repose sur un login backend qui retourne un token JWT. Le frontend utilise ce token pour appeler les API protegees. Le backend applique Spring Security et un filtre JWT pour verifier l'identite de l'utilisateur.

## 9.2 Autorisation

L'autorisation est appliquee a deux niveaux. Cote frontend, le RoleGuard et AccessControlService masquent ou bloquent les pages non autorisees. Cote backend, les endpoints doivent egalement valider les permissions. Cette double securite est importante : masquer un bouton ne suffit jamais, car l'utilisateur pourrait appeler directement une API.

## 9.3 Role Access Map

Role Access Map est une page d'administration permettant de lier visuellement les roles aux fonctionnalites. Elle repond a un besoin reel : les roles d'une entreprise peuvent changer. Par exemple, une entreprise peut creer un profil Knowledge Base Manager ayant acces uniquement a la base de connaissance et a l'article management.

| Role standard | Acces typiques |
|---|---|
| AGENT | CRM, Knowledge Base, Magic Assistance, formations, chat assigne |
| QA | QA Evaluation, tickets necessaires, analytics qualite |
| TEAM_LEADER | Adherence, equipe liee, tickets equipe, KPI |
| ADMIN | Comptes, roles, builders, settings, acces globaux |
| HEAD_CS / OPS | Supervision globale, builders, article management, analytics |
| L1 | Creation et suivi d'escalades |
| L2 | Playlist escalades, tickets assignes, Jira bridge |

## 9.4 Protection des comptes desactives

Un compte desactive ne doit avoir aucun acces. La plateforme prevoit une logique de verification d'etat cote serveur et cote client, avec notification bloquante cote frontend. Pour une production stricte, il est recommande d'ajouter une invalidation active des sessions et un mecanisme de refresh force via polling ou WebSocket.

# 10. Integrations externes et IA

## 10.1 Gmail

L'integration Gmail permet de synchroniser les emails, lire les threads, repondre, gerer les pieces jointes et afficher les conversations dans le CRM. L'utilisation d'OAuth evite de stocker un mot de passe email, mais impose une gestion rigoureuse des tokens et du renouvellement.

## 10.2 Jira

Jira Bridge permet aux L2 de creer ou suivre des tickets Jira depuis la plateforme. Pour eviter les problemes CORS et proteger les identifiants, l'appel Jira doit passer par le backend. L'utilisateur configure ses acces Jira dans Settings ; le backend agit comme pont securise vers l'instance Jira.

## 10.3 OpenAI et assistant IA

Process Assistant utilise des profils de prompt et peut appeler un modele OpenAI via le backend. Les cles API peuvent etre configurees cote backend ou par profil de prompt selon le niveau de controle choisi. L'objectif est d'apporter une assistance metier aux agents : resume, clarification de procedure, reformulation, aide a la decision et preparation de reponse.

## 10.4 WebSockets

WebSocket est utilise pour les communications temps reel : live chat, collaboration, typing, notifications, affectations et messages. Cette approche evite de dependre uniquement du polling et ameliore la reactivite de l'interface.

# 11. Deploiement et exploitation

## 11.1 Dockerisation

Le projet contient des Dockerfiles pour le frontend et le backend. Le frontend peut etre builde en mode SSR avec Node, tandis que le backend Spring Boot est package dans un JAR execute sur une image Java. Docker Compose peut orchestrer les services.

| Service | Role |
|---|---|
| Web Angular SSR | Sert l'application frontend |
| API Spring Boot | Expose les REST APIs et WebSockets |
| MySQL/MariaDB | Stocke les donnees metier |
| Reverse proxy | Sert HTTPS, routage et headers de securite |
| Volumes | Stockage des assets, videos, uploads et sauvegardes |

## 11.2 Deploiement Oracle Cloud Free Tier

Pour un environnement de demonstration ou PFE, Oracle Cloud Free Tier peut heberger une VM ARM, Docker, MySQL/MariaDB et un reverse proxy. Pour une production client, il est recommande de separer la base de donnees, configurer les sauvegardes, activer HTTPS, limiter les acces SSH, surveiller les logs et externaliser les secrets.

## 11.3 Variables sensibles

Les cles Gmail, OpenAI, Jira, Meta, secrets JWT et mots de passe base de donnees ne doivent pas etre stockes dans le frontend. Ils doivent etre geres par variables d'environnement, fichiers secrets ou coffre-fort de secrets.

# 12. Tests, validation et qualite

## 12.1 Validation fonctionnelle

La validation doit couvrir les parcours principaux : login, navigation V3, acces par role, consultation KB, feedback article, tracking analytics, traitement CRM, creation de ticket, live chat public, prise en charge agent, creation de formation, modification d'acces, et configuration utilisateur.

## 12.2 Tests techniques recommandes

| Type de test | Objectif |
|---|---|
| Tests unitaires backend | Valider services, regles metier, workflow engine |
| Tests d'integration API | Verifier endpoints et securite |
| Tests frontend | Valider composants et interactions critiques |
| Tests E2E | Simuler un parcours agent complet |
| Tests WebSocket | Verifier messages temps reel et reconnexion |
| Tests securite | Acces refuse, token expire, compte desactive |
| Tests de charge | Estimer comportement pour 50 agents simultanes |

## 12.3 Qualite logicielle

Le projet est modulaire et evolutif, mais certains points doivent etre renforces avant une production commerciale : migrations versionnees, couverture de tests, observabilite, gestion centralisee des erreurs, logs structures, monitoring, sauvegardes automatiques et documentation d'exploitation.

# 13. Limites et perspectives

## 13.1 Limites actuelles

Le projet est riche fonctionnellement, mais une version production doit etre stabilisee : figer les migrations DB, durcir les endpoints, ajouter des tests automatiques, ameliorer la gestion des secrets, monitorer les performances, et separer les environnements developpement/staging/production.

## 13.2 Perspectives fonctionnelles

Les evolutions les plus pertinentes sont : SSO Keycloak, multi-tenancy, SSO entreprise, integration WhatsApp/Instagram/Messenger officielle, RAG sur la base de connaissance, analytics avances, monitoring temps reel, SLA, business hours, routage par competence, macros de reponse, audit complet, marketplace d'integrations et portail public client.

## 13.3 Perspectives IA

L'IA peut etre renforcee par plusieurs fonctions : recherche semantique dans la KB, suggestions de reponse dans le CRM, detection d'intention, resume automatique de ticket, scoring qualite, generation de SOP, detection de doublons, recommandation d'article, assistant superviseur, et analyse de sentiment.

# 14. Conclusion generale

Focal V3 represente un projet full stack complet qui depasse le cadre d'une simple application CRUD. Il combine plusieurs dimensions d'un produit professionnel : experience utilisateur, architecture logicielle, securite, base de donnees, integrations externes, temps reel, gestion de la connaissance, qualite, formation et pilotage operationnel.

Le projet demontre la capacite a transformer une problematique metier concrete en plateforme modulaire et exploitable. Pour une fintech ou une neobanque, la valeur est directe : meilleure productivite des agents, reponses plus coherentes, visibilite manageriale, controle qualite renforce et preparation a l'automatisation par IA.

Dans un cadre PFE, Focal V3 met en evidence des competences d'ingenierie importantes : analyse fonctionnelle, conception technique, developpement frontend avance, backend securise, modelisation de donnees, integration API, UI/UX, deploiement Docker et reflexion produit. Il constitue une base solide pour une soutenance orientee innovation, qualite operationnelle et industrialisation.

# 15. Annexes

## Annexe A - Principales routes V3

| Route | Module |
|---|---|
| `/v3/home` | Command Center |
| `/v3/crm` | CRM Inbox |
| `/v3/knowledge-base` | Knowledge Base |
| `/v3/kb-analytics` | Knowledge Base Analytics |
| `/v3/magic-assistance` | Magic Assistance |
| `/v3/collaboration` | Collaboration Hub |
| `/v3/chat-projects` | Chat Projects |
| `/v3/live-chat` | Live Chat |
| `/v3/process-assistant` | Process Assistant |
| `/v3/academy` | My Trainings |
| `/v3/academy/catalog` | Training Catalog |
| `/v3/academy/studio` | Training Studio |
| `/v3/academy/analytics` | Training Analytics |
| `/v3/calendar` | Calendar |
| `/v3/flowdesk/board` | FlowDesk Board |
| `/v3/flowdesk/escalations` | Escalation Desk |
| `/v3/article-management` | Article Management |
| `/v3/tree-builder` | Magic Assistance Tree Builder |
| `/v3/kb-map-builder` | KB Map Builder |
| `/v3/case-tag-builder` | Case Tag Builder |
| `/v3/prompt-map-builder` | Prompt Map Builder |
| `/v3/role-access-map` | Role Access Map |
| `/v3/staff-management` | Staff Management |
| `/v3/settings` | User Settings |

## Annexe B - Principaux endpoints backend

| Domaine | Endpoint principal |
|---|---|
| Authentification | `/auth/login` |
| Etat applicatif | `/api/state` |
| Knowledge Base | `/api/kb/categories`, `/api/kb/articles` |
| KB Maps | `/api/kb-map` |
| KB Analytics | `/api/kb/analytics` |
| Magic Assistance | `/api/pages` |
| CRM | `/api/crm` |
| Gmail | `/api/gmail` |
| Case Tags | `/api/case-tags` |
| Staff | `/api/staff` |
| Acces roles | `/api/access-control` |
| Presence | `/api/presence` |
| Collaboration | `/api/collaboration` |
| Chat Projects | `/api/chat-projects` |
| Public Chat API | `/api/public/chat` |
| Live Chat | `/api/live-chat` |
| Process Assistant | `/api/process-assistant` |
| Training Assets | `/api/training-assets` |
| Jira Bridge | `/api/jira` |
| Escalations | `/api/escalations` |
| Settings | `/api/settings` |

## Annexe C - Stack technique

| Partie | Technologies |
|---|---|
| Frontend | Angular 21, TypeScript, RxJS, CSS, Angular Router |
| Backend | Java, Spring Boot 4, Spring Security, Spring WebMVC, Spring WebSocket |
| Base de donnees | MySQL/MariaDB, JPA/Hibernate |
| Authentification | JWT, Spring Security |
| Integrations | Gmail OAuth, OpenAI API, Jira REST, Meta-ready |
| Deploiement | Docker, Docker Compose, SSR Node runtime |
| Qualite | Tests unitaires recommandes, E2E recommandes, logs, monitoring futur |

## Annexe D - Recommandations avant production

- Remplacer `ddl-auto=update` par des migrations versionnees.
- Ajouter Flyway ou Liquibase.
- Stocker les secrets hors du code source.
- Activer HTTPS avec reverse proxy.
- Ajouter monitoring applicatif et logs structures.
- Mettre en place backups automatiques de la base de donnees.
- Tester les acces par role cote backend.
- Ajouter des tests E2E sur les parcours critiques.
- Preparer un environnement staging.
- Documenter les procedures d'exploitation.

## Annexe E - Bibliographie indicative

- Documentation Angular officielle pour routing, standalone components, SSR et build production.
- Documentation Spring Boot et Spring Security pour REST APIs, securite JWT et WebSocket.
- Documentation MySQL/MariaDB pour conception relationnelle, index et sauvegardes.
- Documentation OAuth 2.0 pour integration Gmail.
- Documentation OpenAI API pour integration de modeles IA.
- Documentation Jira REST API pour creation et suivi de tickets.
- OWASP Top 10 pour bonnes pratiques de securite web.
