$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$OutDir = Join-Path $Root "docs\pfe"
$ShotDir = Join-Path $OutDir "screenshots"
$PptxOut = Join-Path $OutDir "presentation-pfe-focal-assist-v3.pptx"
$PdfOut = Join-Path $OutDir "presentation-pfe-focal-assist-v3.pdf"
$Logo = Join-Path $Root "tmp_template_image1.png"

function Rgb([int]$r, [int]$g, [int]$b) {
  return $r + ($g -shl 8) + ($b -shl 16)
}

$Colors = @{
  Navy = Rgb 10 24 56
  Blue = Rgb 46 99 235
  Cyan = Rgb 0 167 165
  SoftBlue = Rgb 232 240 255
  SoftCyan = Rgb 229 249 247
  Ink = Rgb 31 41 55
  Muted = Rgb 100 116 139
  Border = Rgb 211 223 235
  Bg = Rgb 248 251 255
  White = Rgb 255 255 255
  Green = Rgb 22 163 74
  Orange = Rgb 234 88 12
}

$msoFalse = 0
$msoTrue = -1
$ppLayoutBlank = 12
$ppSaveAsOpenXMLPresentation = 24
$ppFixedFormatTypePDF = 2

function Add-Text($slide, [string]$text, [double]$x, [double]$y, [double]$w, [double]$h, [int]$size = 18, [int]$color = $Colors.Ink, [bool]$bold = $false, [string]$font = "Arial") {
  $shape = $slide.Shapes.AddTextbox(1, $x, $y, $w, $h)
  $shape.TextFrame.TextRange.Text = $text
  $shape.TextFrame.TextRange.Font.Name = $font
  $shape.TextFrame.TextRange.Font.Size = $size
  $shape.TextFrame.TextRange.Font.Color.RGB = $color
  $shape.TextFrame.TextRange.Font.Bold = if ($bold) { -1 } else { 0 }
  $shape.TextFrame.MarginLeft = 0
  $shape.TextFrame.MarginRight = 0
  $shape.TextFrame.MarginTop = 0
  $shape.TextFrame.MarginBottom = 0
  return $shape
}

function Add-Card($slide, [double]$x, [double]$y, [double]$w, [double]$h, [int]$fill = $Colors.White, [int]$line = $Colors.Border) {
  $shape = $slide.Shapes.AddShape(5, $x, $y, $w, $h)
  $shape.Fill.ForeColor.RGB = $fill
  $shape.Line.ForeColor.RGB = $line
  $shape.Line.Weight = 1
  return $shape
}

function Add-TopBar($slide, [string]$section, [int]$num) {
  $bar = $slide.Shapes.AddShape(1, 0, 0, 960, 46)
  $bar.Fill.ForeColor.RGB = $Colors.White
  $bar.Line.ForeColor.RGB = $Colors.Border
  Add-Text $slide "Focal V3" 28 14 180 18 11 $Colors.Navy $true | Out-Null
  Add-Text $slide $section 744 14 130 18 10 $Colors.Muted $false | Out-Null
  Add-Text $slide ("{0:00}" -f $num) 900 13 32 18 10 $Colors.Blue $true | Out-Null
}

function Add-Title($slide, [string]$title, [string]$subtitle = "") {
  Add-Text $slide $title 54 70 820 48 28 $Colors.Navy $true | Out-Null
  $accent = $slide.Shapes.AddShape(1, 54, 123, 88, 4)
  $accent.Fill.ForeColor.RGB = $Colors.Cyan
  $accent.Line.Visible = $msoFalse
  if ($subtitle.Trim()) {
    Add-Text $slide $subtitle 54 138 780 36 14 $Colors.Muted $false | Out-Null
  }
}

function Add-Bullets($slide, [string[]]$items, [double]$x, [double]$y, [double]$w, [double]$h, [int]$size = 17) {
  $text = ($items | ForEach-Object { "â€¢ $_" }) -join "`r"
  $shape = Add-Text $slide $text $x $y $w $h $size $Colors.Ink $false
  $shape.TextFrame.TextRange.ParagraphFormat.SpaceAfter = 8
  return $shape
}

function Add-ImageFit($slide, [string]$path, [double]$x, [double]$y, [double]$w, [double]$h) {
  if (!(Test-Path $path)) { return $null }
  Add-Type -AssemblyName System.Drawing
  $img = [System.Drawing.Image]::FromFile($path)
  $aspect = $img.Width / $img.Height
  $boxAspect = $w / $h
  if ($aspect -gt $boxAspect) {
    $drawW = $w
    $drawH = $w / $aspect
  } else {
    $drawH = $h
    $drawW = $h * $aspect
  }
  $img.Dispose()
  $left = $x + (($w - $drawW) / 2)
  $top = $y + (($h - $drawH) / 2)
  $pic = $slide.Shapes.AddPicture((Resolve-Path $path).Path, $msoFalse, $msoTrue, $left, $top, $drawW, $drawH)
  return $pic
}

function Add-ScreenshotCard($slide, [string]$path, [double]$x, [double]$y, [double]$w, [double]$h) {
  Add-Card $slide $x $y $w $h $Colors.White $Colors.Border | Out-Null
  Add-ImageFit $slide $path ($x + 8) ($y + 8) ($w - 16) ($h - 16) | Out-Null
}

function Add-Stat($slide, [string]$value, [string]$label, [double]$x, [double]$y) {
  Add-Card $slide $x $y 190 92 $Colors.White $Colors.Border | Out-Null
  Add-Text $slide $value ($x + 18) ($y + 16) 150 26 24 $Colors.Blue $true | Out-Null
  Add-Text $slide $label ($x + 18) ($y + 50) 150 28 11 $Colors.Muted $false | Out-Null
}

function Add-Flow($slide, [string[]]$steps, [double]$x, [double]$y, [double]$w) {
  $boxW = ($w - (($steps.Count - 1) * 28)) / $steps.Count
  for ($i = 0; $i -lt $steps.Count; $i++) {
    $bx = $x + ($i * ($boxW + 28))
    Add-Card $slide $bx $y $boxW 74 $Colors.White $Colors.Border | Out-Null
    Add-Text $slide $steps[$i] ($bx + 12) ($y + 20) ($boxW - 24) 34 12 $Colors.Navy $true | Out-Null
    if ($i -lt $steps.Count - 1) {
      $line = $slide.Shapes.AddLine(($bx + $boxW + 4), ($y + 37), ($bx + $boxW + 24), ($y + 37))
      $line.Line.ForeColor.RGB = $Colors.Cyan
      $line.Line.Weight = 2.5
    }
  }
}

function New-Slide($presentation, [string]$section, [int]$num) {
  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, $ppLayoutBlank)
  $bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
  $bg.Fill.ForeColor.RGB = $Colors.Bg
  $bg.Line.Visible = $msoFalse
  Add-TopBar $slide $section $num
  return $slide
}

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = $msoTrue
$presentation = $ppt.Presentations.Add()
$presentation.PageSetup.SlideWidth = 960
$presentation.PageSetup.SlideHeight = 540

$n = 1

# 1 Cover
$slide = $presentation.Slides.Add($n, $ppLayoutBlank)
$bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
$bg.Fill.ForeColor.RGB = $Colors.Bg
$bg.Line.Visible = $msoFalse
Add-ScreenshotCard $slide (Join-Path $ShotDir "02-command-center.png") 480 58 420 292
$hero = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
$hero.Fill.ForeColor.RGB = $Colors.Bg
$hero.Fill.Transparency = 0.18
$hero.Line.Visible = $msoFalse
if (Test-Path $Logo) { Add-ImageFit $slide $Logo 54 42 180 70 | Out-Null }
Add-Text $slide "Projet de Fin d'Etudes" 54 128 420 24 15 $Colors.Cyan $true | Out-Null
Add-Text $slide "Focal V3" 54 162 420 44 34 $Colors.Navy $true | Out-Null
Add-Text $slide "Plateforme omnicanale d'assistance operationnelle et de gestion des connaissances" 54 212 470 72 21 $Colors.Ink $true | Out-Null
Add-Text $slide "Cycle d'ingenieur | ISMAGI | 2025 - 2026" 54 306 420 22 13 $Colors.Muted $false | Out-Null
Add-Text $slide "Realise par : Abdelfattah AZELMADI" 54 344 390 24 15 $Colors.Navy $true | Out-Null
Add-Text $slide "Architecture full stack Angular 21 + Spring Boot 4 + MySQL" 54 374 430 20 12 $Colors.Muted $false | Out-Null
$n++

# 2 Sommaire
$slide = New-Slide $presentation "Structure" $n
Add-Title $slide "Sommaire" "Une soutenance orientee probleme, solution, conception, demonstration et valeur."
Add-Bullets $slide @(
  "Contexte, problematique et objectifs",
  "Analyse des besoins et cahier des charges",
  "Solution proposee et technologies utilisees",
  "Conception : cas d'utilisation, classes, sequences, donnees",
  "Architecture, implementation et demonstration",
  "Difficultes, resultats, limites, perspectives et conclusion"
) 86 168 760 230 19 | Out-Null
$n++

# 3 Contexte
$slide = New-Slide $presentation "Contexte" $n
Add-Title $slide "Contexte du projet" "Les fintechs ont besoin d'un support rapide, coherent et controlable."
Add-Stat $slide "Support" "Canaux clients, emails, chat et escalades" 70 170
Add-Stat $slide "Knowledge" "Articles, SOP maps et procedures agents" 282 170
Add-Stat $slide "Quality" "QA, adherence, analytics et supervision" 494 170
Add-Stat $slide "AI" "Assistant processus et prompts par role" 706 170
Add-Bullets $slide @(
  "Les agents doivent repondre vite tout en respectant des procedures sensibles.",
  "Les superviseurs ont besoin d'indicateurs fiables sur l'activite et la connaissance.",
  "Les outils separes augmentent les erreurs, les doublons et le temps de traitement."
) 98 305 770 110 18 | Out-Null
$n++

# 4 Problem
$slide = New-Slide $presentation "Problematique" $n
Add-Title $slide "Problematique" "Comment industrialiser le support client sans perdre la qualite operationnelle ?"
Add-Card $slide 70 165 820 200 $Colors.White $Colors.Border | Out-Null
Add-Text $slide "Comment concevoir une plateforme centralisee capable d'ameliorer la productivite du support client tout en garantissant la qualite, la tracabilite, la coherence des reponses et l'adaptabilite aux processus internes d'une fintech ?" 112 202 730 90 22 $Colors.Navy $true | Out-Null
Add-Bullets $slide @(
  "Reduire les temps de traitement.",
  "Eviter les reponses incoherentes entre agents.",
  "Rendre les procedures visibles, mesurables et ameliorables.",
  "Proteger les donnees et limiter les acces par role."
) 110 390 760 100 15 | Out-Null
$n++

# 5 Objectives
$slide = New-Slide $presentation "Objectifs" $n
Add-Title $slide "Objectifs du projet" "Construire un cockpit de support complet, extensible et pret pour une fintech."
Add-Bullets $slide @(
  "Centraliser CRM, base de connaissance, chat, formation, QA et escalade.",
  "Guider les agents avec des arbres de decision et des cartes SOP.",
  "Ajouter une assistance IA controlee par prompts et par roles.",
  "Mesurer l'utilisation des articles et le temps passe par agent.",
  "Gerer les droits dynamiquement via Role Access Map.",
  "Preparer le deploiement Docker et l'exploitation cloud."
) 80 158 820 260 19 | Out-Null
$n++

# 6 Needs
$slide = New-Slide $presentation "Analyse" $n
Add-Title $slide "Analyse des besoins" "Les besoins sont organises autour des acteurs et de leurs responsabilites."
Add-Flow $slide @("Agent", "Team Leader", "QA", "Admin", "OPS") 75 170 810
Add-Bullets $slide @(
  "Agent : traiter les demandes, consulter la KB, suivre les procedures.",
  "Team Leader : suivre l'adherence, les tickets et les performances d'equipe.",
  "QA : evaluer les interactions et produire des feedbacks exploitables.",
  "Admin/OPS : configurer comptes, roles, builders, integrations et analytics."
) 92 295 780 130 16 | Out-Null
$n++

# 7 Specs
$slide = New-Slide $presentation "Cahier des charges" $n
Add-Title $slide "Cahier des charges" "Synthese des exigences fonctionnelles et non fonctionnelles."
Add-Card $slide 62 155 390 260 $Colors.White $Colors.Border | Out-Null
Add-Text $slide "Fonctionnel" 88 176 300 24 20 $Colors.Blue $true | Out-Null
Add-Bullets $slide @(
  "Authentification et roles",
  "CRM email et tickets",
  "Knowledge Base + SOP maps",
  "Magic Assistance",
  "Collaboration + Live Chat",
  "Formation, QA et adherence"
) 88 215 310 160 15 | Out-Null
Add-Card $slide 508 155 390 260 $Colors.White $Colors.Border | Out-Null
Add-Text $slide "Non fonctionnel" 534 176 300 24 20 $Colors.Cyan $true | Out-Null
Add-Bullets $slide @(
  "Securite JWT",
  "API backend centralisee",
  "WebSocket temps reel",
  "Base relationnelle",
  "Dockerisation",
  "Architecture modulaire"
) 534 215 310 160 15 | Out-Null
$n++

# 8 Existing
$slide = New-Slide $presentation "Etat de l'existant" $n
Add-Title $slide "Etude de l'existant" "Les outils existants sont puissants, mais souvent fragmentes ou couteux."
Add-Bullets $slide @(
  "Zendesk : CRM support complet, mais personnalisation avancee couteuse.",
  "Helpjuice : tres fort sur la knowledge base, moins centre operations internes.",
  "Slack : excellent pour la collaboration, mais pas lie nativement aux SOP et QA.",
  "Jira : puissant pour L2/tech, mais peu adapte au front support agent.",
  "Focal V3 : approche unifiee autour du support, connaissance et operations."
) 80 160 800 220 18 | Out-Null
$n++

# 9 Solution
$slide = New-Slide $presentation "Solution" $n
Add-Title $slide "Solution proposee" "Un shell V3 unique qui regroupe les workflows critiques."
Add-ScreenshotCard $slide (Join-Path $ShotDir "02-command-center.png") 470 142 410 255
Add-Bullets $slide @(
  "V3 Shell comme cockpit principal.",
  "Modules independants mais relies par une navigation uniforme.",
  "Acces par role et par feature.",
  "Builders visuels pour adapter les processus sans recoder.",
  "Analytics pour transformer l'usage en decisions."
) 70 160 350 210 16 | Out-Null
$n++

# 10 Technologies
$slide = New-Slide $presentation "Technologies" $n
Add-Title $slide "Technologies utilisees" "Stack full stack moderne, maintenable et deployable."
Add-Flow $slide @("Angular 21", "Spring Boot 4", "REST + WS", "MySQL", "Docker") 70 168 820
Add-Bullets $slide @(
  "Frontend : Angular standalone components, Router, RxJS, CSS, lazy loading.",
  "Backend : Java, Spring Security, WebMVC, WebSocket, JPA/Hibernate.",
  "Donnees : MySQL/MariaDB, tables metier, historiques et logs.",
  "Integrations : Gmail OAuth, OpenAI, Jira REST, API publiques chat.",
  "Deploiement : Docker, Docker Compose, reverse proxy, cloud-ready."
) 90 292 780 130 16 | Out-Null
$n++

# 11 Conception
$slide = New-Slide $presentation "Conception" $n
Add-Title $slide "Conception UX/UI" "Une interface V3 minimaliste, lisible et orientee productivite."
Add-ScreenshotCard $slide (Join-Path $ShotDir "11-role-access-map.png") 518 130 360 300
Add-Bullets $slide @(
  "Sidebar stable : Workspace, Academy, Build, Manage, Delivery.",
  "Topbar globale : recherche, langue, timezone, statut et collaboration.",
  "Canvas maps : noeuds, connecteurs, zoom, pan et inspecteurs.",
  "Animations limitees au contenu pour ne pas perturber la navigation.",
  "Design coherent avec la charte ISMAGI : bleu, turquoise, typographie sobre."
) 72 150 390 210 16 | Out-Null
$n++

# 12 Use cases
$slide = New-Slide $presentation "UML" $n
Add-Title $slide "Diagramme de cas d'utilisation" "Vue fonctionnelle simplifiee par acteur."
Add-Flow $slide @("Agent", "Supervisor", "Admin", "Client public") 80 160 800
Add-Bullets $slide @(
  "Agent : consulter KB, traiter CRM, utiliser Magic Assistance, suivre formations.",
  "Supervisor : consulter dashboards, adherence, QA et analytics.",
  "Admin : gerer comptes, roles, builders, articles et integrations.",
  "Client public : demarrer une conversation via chatbot public."
) 98 285 780 130 17 | Out-Null
$n++

# 13 Class diagram
$slide = New-Slide $presentation "UML" $n
Add-Title $slide "Diagramme de classes" "Extrait conceptuel des principales familles d'entites."
$classes = @(
  @("User", "id, name, email, role, active"),
  @("KbArticle", "category, title, content, map"),
  @("ChatProject", "slug, workflow, queues, apiKey"),
  @("LiveChatSession", "project, status, assignee"),
  @("EscalationTicket", "clientId, priority, status, jiraKey"),
  @("RoleAccessProfile", "role, features, links")
)
for ($i=0; $i -lt $classes.Count; $i++) {
  $x = 72 + (($i % 3) * 282)
  $y = 155 + ([math]::Floor($i / 3) * 135)
  Add-Card $slide $x $y 238 90 $Colors.White $Colors.Border | Out-Null
  Add-Text $slide $classes[$i][0] ($x+16) ($y+14) 200 22 18 $Colors.Blue $true | Out-Null
  Add-Text $slide $classes[$i][1] ($x+16) ($y+48) 200 24 12 $Colors.Muted $false | Out-Null
}
$n++

# 14 Sequence
$slide = New-Slide $presentation "UML" $n
Add-Title $slide "Diagramme de sequence" "Exemple : conversation publique puis escalade vers agent."
Add-Flow $slide @("Client", "Public Chat", "Workflow Engine", "Queue", "Agent") 60 170 840
Add-Bullets $slide @(
  "1. Le client ouvre /chat/{projectSlug} et demarre une session.",
  "2. Le workflow engine execute les noeuds : message, choix, texte ou booleen.",
  "3. Si escalation : selection de queue et affectation d'un agent disponible.",
  "4. Le live chat passe en temps reel via WebSocket.",
  "5. La session est fermee avec CSAT et historique conserve."
) 90 295 780 130 16 | Out-Null
$n++

# 15 Data model
$slide = New-Slide $presentation "Donnees" $n
Add-Title $slide "Modele de donnees" "Une base relationnelle organisee par domaines metier."
Add-Bullets $slide @(
  "Utilisateurs : User, UserStatus, UserStatusHistory, RoleAccessProfile.",
  "Knowledge : KbCategory, KbArticle, KbMapNode, KbMapEdge, KbArticleTimeLog.",
  "CRM : CemConversation, CemContact, CaseTagNode, CemInternalNote.",
  "Chat : ChatProject, ChatQueue, LiveChatSession, LiveChatMessage.",
  "IA : ProcessAssistantConversation, Message, PromptProfile, PromptRoleLink.",
  "Delivery : EscalationTicket, EscalationComment, Jira fields."
) 80 156 800 240 17 | Out-Null
$n++

# 16 Architecture
$slide = New-Slide $presentation "Architecture" $n
Add-Title $slide "Architecture du systeme" "Separation claire frontend, backend, base et integrations."
Add-Flow $slide @("Angular V3", "REST API", "Spring Services", "JPA", "MySQL") 55 160 850
Add-Flow $slide @("Public Chat", "WebSocket", "Live Chat", "Agent UI") 170 285 620
Add-Bullets $slide @(
  "Les secrets et integrations sensibles passent par le backend.",
  "Le frontend reste oriente affichage, interactions et experience utilisateur.",
  "Les services backend isolent la logique metier et les permissions.",
  "Docker prepare le deploiement local, cloud ou VPS."
) 105 398 760 90 14 | Out-Null
$n++

# 17 Implementation
$slide = New-Slide $presentation "Implementation" $n
Add-Title $slide "Developpement / Implementation" "Modules implementes avec composants Angular et controllers Spring Boot."
Add-Bullets $slide @(
  "Frontend : routes V3 lazy-loaded, services HTTP, composants par domaine.",
  "Backend : controllers REST, services metier, repositories JPA et security filters.",
  "Temps reel : WebSocket pour chat, collaboration et notifications.",
  "Build : Angular production, Spring Boot JAR, Dockerfiles frontend/backend.",
  "Documentation : rapport PFE, guide Oracle Cloud, scripts de generation."
) 80 160 800 210 18 | Out-Null
$n++

# 18 Features
$slide = New-Slide $presentation "Fonctionnalites" $n
Add-Title $slide "Fonctionnalites principales" "Une plateforme complete pour support, connaissance, qualite et operations."
Add-Bullets $slide @(
  "CRM Inbox : emails, notes internes, tags, pieces jointes et conversations.",
  "Knowledge Base : articles, SOP maps, feedback, analytics de lecture.",
  "Magic Assistance : arbres de decision et workflows agents.",
  "Process Copilot : assistant IA avec prompts par role.",
  "Collaboration + Live Chat : communication interne et client.",
  "Academy + QA + Adherence : formation, evaluation et pilotage."
) 70 150 410 260 16 | Out-Null
Add-ScreenshotCard $slide (Join-Path $ShotDir "03-knowledge-base.png") 515 145 360 235
$n++

# 19 Demo home
$slide = New-Slide $presentation "Demonstration" $n
Add-Title $slide "Demonstration - Command Center" "Point d'entree V3 et navigation role-based."
Add-ScreenshotCard $slide (Join-Path $ShotDir "02-command-center.png") 54 135 850 360
$n++

# 20 Demo KB
$slide = New-Slide $presentation "Demonstration" $n
Add-Title $slide "Demonstration - Knowledge Base & Analytics" "Recherche, lecture, SOP maps et mesure d'usage."
Add-ScreenshotCard $slide (Join-Path $ShotDir "03-knowledge-base.png") 58 145 400 285
Add-ScreenshotCard $slide (Join-Path $ShotDir "04-kb-analytics.png") 502 145 400 285
$n++

# 21 Demo CRM Magic
$slide = New-Slide $presentation "Demonstration" $n
Add-Title $slide "Demonstration - CRM & Magic Assistance" "Traitement client et guidage procedurier."
Add-ScreenshotCard $slide (Join-Path $ShotDir "06-crm-inbox.png") 58 145 400 285
Add-ScreenshotCard $slide (Join-Path $ShotDir "05-magic-assistance.png") 502 145 400 285
$n++

# 22 Demo chat AI
$slide = New-Slide $presentation "Demonstration" $n
Add-Title $slide "Demonstration - Chat, Live Chat & Process Copilot" "Canaux modernes et assistance IA controlee."
Add-ScreenshotCard $slide (Join-Path $ShotDir "07-chat-projects.png") 50 145 275 270
Add-ScreenshotCard $slide (Join-Path $ShotDir "08-live-chat.png") 342 145 275 270
Add-ScreenshotCard $slide (Join-Path $ShotDir "09-process-assistant.png") 634 145 275 270
$n++

# 23 Difficulties
$slide = New-Slide $presentation "Retour d'experience" $n
Add-Title $slide "Difficultes rencontrees et solutions" "Les problemes techniques ont ete traites par architecture et instrumentation."
Add-Bullets $slide @(
  "Synchronisation UI Angular : ajout de listeners, markForCheck et mise a jour d'etat.",
  "Tokens Gmail expires : fallback DB et reconnexion OAuth.",
  "CORS Jira : passage par backend bridge pour securiser et eviter les appels navigateur.",
  "Cartes et builders : alignement connecteurs, pan/zoom, UX de liaison.",
  "Acces roles : externalisation vers DB et Role Access Map.",
  "Donnees temps reel : WebSocket et strategies de polling controlees."
) 78 155 820 250 17 | Out-Null
$n++

# 24 Results
$slide = New-Slide $presentation "Resultats" $n
Add-Title $slide "Resultats obtenus" "Un prototype avance, coherent et demonstrable."
Add-Stat $slide "20+" "Pages V3 et modules metier" 90 165
Add-Stat $slide "REST" "APIs backend par domaine" 300 165
Add-Stat $slide "WS" "Chat et collaboration temps reel" 510 165
Add-Stat $slide "Docker" "Deploiement prepare" 720 165
Add-Bullets $slide @(
  "Interface unifiee autour de V3.",
  "Base de connaissance mesurable avec feedback.",
  "Builders visuels reutilisables.",
  "Gestion roles/acces configurable.",
  "Architecture extensible vers SaaS ou self-hosted."
) 110 305 760 120 17 | Out-Null
$n++

# 25 Limits
$slide = New-Slide $presentation "Limites" $n
Add-Title $slide "Limites du projet" "Points a renforcer avant production commerciale."
Add-Bullets $slide @(
  "Remplacer ddl-auto update par migrations Flyway/Liquibase.",
  "Ajouter couverture de tests backend, frontend et E2E.",
  "Centraliser la gestion des erreurs et logs structures.",
  "Durcir les secrets et la configuration par environnement.",
  "Ajouter monitoring, backups automatises et alerting.",
  "Valider la charge reelle avec plusieurs dizaines d'agents."
) 80 155 800 240 18 | Out-Null
$n++

# 26 Perspectives
$slide = New-Slide $presentation "Perspectives" $n
Add-Title $slide "Perspectives d'amelioration" "Passer d'un outil operationnel a une plateforme SaaS industrielle."
Add-Bullets $slide @(
  "SSO Keycloak, multi-tenancy et audit complet.",
  "RAG sur la base de connaissance avec recherche semantique.",
  "WhatsApp, Instagram, Messenger et Telegram officiels.",
  "SLA, business hours, routage par competence et macros.",
  "Kubernetes, observabilite et CI/CD complete.",
  "Portail public client avec tickets, KB et CSAT."
) 80 155 800 240 18 | Out-Null
$n++

# 27 Conclusion
$slide = New-Slide $presentation "Conclusion" $n
Add-Title $slide "Conclusion" "Focal V3 est un projet full stack oriente produit, operations et scalabilite."
Add-Card $slide 88 175 790 190 $Colors.White $Colors.Border | Out-Null
Add-Text $slide "Le projet demontre la capacite a transformer une problematique metier concrete en plateforme modulaire : support client, knowledge management, IA, collaboration, formation, qualite, analytics et escalade. Il constitue une base solide pour une fintech ou une neobanque qui souhaite industrialiser ses operations client." 124 214 720 90 21 $Colors.Navy $true | Out-Null
Add-Text $slide "Valeur principale : rendre les agents plus rapides, les reponses plus coherentes et les decisions manageriales plus mesurables." 124 322 720 36 15 $Colors.Cyan $true | Out-Null
$n++

# 28 Questions
$slide = $presentation.Slides.Add($presentation.Slides.Count + 1, $ppLayoutBlank)
$bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
$bg.Fill.ForeColor.RGB = $Colors.Navy
$bg.Line.Visible = $msoFalse
Add-Text $slide "Questions ?" 80 150 700 68 46 $Colors.White $true | Out-Null
Add-Text $slide "Merci pour votre attention" 84 230 600 30 20 $Colors.Cyan $true | Out-Null
Add-Text $slide "Projet de Fin d'Etudes - Focal V3 - Abdelfattah AZELMADI" 84 420 760 24 13 (Rgb 210 220 240) $false | Out-Null

if (Test-Path $PptxOut) { Remove-Item $PptxOut -Force }
if (Test-Path $PdfOut) { Remove-Item $PdfOut -Force }

$presentation.SaveAs($PptxOut, $ppSaveAsOpenXMLPresentation)
$presentation.SaveAs($PdfOut, 32)
$presentation.Close()
$ppt.Quit()

Write-Output $PptxOut
Write-Output $PdfOut

