$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$OutDir = Join-Path $Root "docs\pfe"
$ShotDir = Join-Path $OutDir "screenshots-full"
$PptxOut = Join-Path $OutDir "presentation-pfe-focal-assist-v3-detailed.pptx"
$PdfOut = Join-Path $OutDir "presentation-pfe-focal-assist-v3-detailed.pdf"
$Logo = Join-Path $Root "tmp_template_image1.png"

function Rgb([int]$r, [int]$g, [int]$b) { return $r + ($g -shl 8) + ($b -shl 16) }

$C = @{
  Navy = Rgb 9 20 48
  Ink = Rgb 30 41 59
  Muted = Rgb 100 116 139
  Blue = Rgb 46 99 235
  Cyan = Rgb 0 167 165
  Green = Rgb 22 163 74
  Orange = Rgb 234 88 12
  Red = Rgb 220 38 38
  Bg = Rgb 247 250 255
  White = Rgb 255 255 255
  Border = Rgb 205 218 235
  SoftBlue = Rgb 232 240 255
  SoftCyan = Rgb 228 250 247
  SoftOrange = Rgb 255 247 237
}

$msoFalse = 0
$msoTrue = -1
$ppLayoutBlank = 12
$ppSaveAsOpenXMLPresentation = 24

function Add-Text($slide, [string]$text, [double]$x, [double]$y, [double]$w, [double]$h, [int]$size = 16, [int]$color = $C.Ink, [bool]$bold = $false) {
  $shape = $slide.Shapes.AddTextbox(1, $x, $y, $w, $h)
  $shape.TextFrame.TextRange.Text = $text
  $shape.TextFrame.TextRange.Font.Name = "Arial"
  $shape.TextFrame.TextRange.Font.Size = $size
  $shape.TextFrame.TextRange.Font.Color.RGB = $color
  $shape.TextFrame.TextRange.Font.Bold = if ($bold) { -1 } else { 0 }
  $shape.TextFrame.MarginLeft = 0
  $shape.TextFrame.MarginRight = 0
  $shape.TextFrame.MarginTop = 0
  $shape.TextFrame.MarginBottom = 0
  return $shape
}

function Add-Card($slide, [double]$x, [double]$y, [double]$w, [double]$h, [int]$fill = $C.White, [int]$line = $C.Border) {
  $shape = $slide.Shapes.AddShape(5, $x, $y, $w, $h)
  $shape.Fill.ForeColor.RGB = $fill
  $shape.Line.ForeColor.RGB = $line
  $shape.Line.Weight = 1
  return $shape
}

function Add-TopBar($slide, [string]$section, [int]$num) {
  $bar = $slide.Shapes.AddShape(1, 0, 0, 960, 44)
  $bar.Fill.ForeColor.RGB = $C.White
  $bar.Line.ForeColor.RGB = $C.Border
  Add-Text $slide "Focal V3 - PFE" 28 13 220 18 10 $C.Navy $true | Out-Null
  Add-Text $slide $section 710 13 150 18 10 $C.Muted $false | Out-Null
  Add-Text $slide ("{0:00}" -f $num) 902 12 34 18 10 $C.Blue $true | Out-Null
}

function New-Slide($presentation, [string]$section, [int]$num) {
  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, $ppLayoutBlank)
  $bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
  $bg.Fill.ForeColor.RGB = $C.Bg
  $bg.Line.Visible = $msoFalse
  Add-TopBar $slide $section $num
  return $slide
}

function Add-Title($slide, [string]$title, [string]$subtitle = "") {
  Add-Text $slide $title 54 66 850 44 27 $C.Navy $true | Out-Null
  $accent = $slide.Shapes.AddShape(1, 54, 118, 92, 4)
  $accent.Fill.ForeColor.RGB = $C.Cyan
  $accent.Line.Visible = $msoFalse
  if ($subtitle.Trim()) { Add-Text $slide $subtitle 54 133 820 32 13 $C.Muted $false | Out-Null }
}

function Add-Bullets($slide, [string[]]$items, [double]$x, [double]$y, [double]$w, [double]$h, [int]$size = 15) {
  $text = ($items | ForEach-Object { "• $_" }) -join "`r"
  $shape = Add-Text $slide $text $x $y $w $h $size $C.Ink $false
  $shape.TextFrame.TextRange.ParagraphFormat.SpaceAfter = 7
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
  return $slide.Shapes.AddPicture((Resolve-Path $path).Path, $msoFalse, $msoTrue, $left, $top, $drawW, $drawH)
}

function Add-ScreenshotCard($slide, [string]$path, [double]$x, [double]$y, [double]$w, [double]$h) {
  Add-Card $slide $x $y $w $h $C.White $C.Border | Out-Null
  Add-ImageFit $slide $path ($x + 8) ($y + 8) ($w - 16) ($h - 16) | Out-Null
}

function Add-Flow($slide, [string[]]$steps, [double]$x, [double]$y, [double]$w, [int]$fill = $C.White) {
  $boxW = ($w - (($steps.Count - 1) * 24)) / $steps.Count
  for ($i = 0; $i -lt $steps.Count; $i++) {
    $bx = $x + ($i * ($boxW + 24))
    Add-Card $slide $bx $y $boxW 70 $fill $C.Border | Out-Null
    Add-Text $slide $steps[$i] ($bx + 10) ($y + 18) ($boxW - 20) 32 12 $C.Navy $true | Out-Null
    if ($i -lt $steps.Count - 1) {
      $line = $slide.Shapes.AddLine(($bx + $boxW + 3), ($y + 35), ($bx + $boxW + 21), ($y + 35))
      $line.Line.ForeColor.RGB = $C.Cyan
      $line.Line.Weight = 2.5
    }
  }
}

function Add-Stat($slide, [string]$value, [string]$label, [double]$x, [double]$y, [int]$accent = $C.Blue) {
  Add-Card $slide $x $y 190 92 $C.White $C.Border | Out-Null
  Add-Text $slide $value ($x + 18) ($y + 14) 150 30 24 $accent $true | Out-Null
  Add-Text $slide $label ($x + 18) ($y + 50) 150 30 10 $C.Muted $false | Out-Null
}

function Add-ClassBox($slide, [string]$name, [string[]]$attrs, [double]$x, [double]$y, [double]$w = 188, [double]$h = 98, [int]$accent = $C.Blue) {
  Add-Card $slide $x $y $w $h $C.White $C.Border | Out-Null
  $header = $slide.Shapes.AddShape(1, $x, $y, $w, 26)
  $header.Fill.ForeColor.RGB = $accent
  $header.Line.Visible = $msoFalse
  Add-Text $slide $name ($x + 8) ($y + 6) ($w - 16) 14 9 $C.White $true | Out-Null
  Add-Text $slide (($attrs | ForEach-Object { "+ $_" }) -join "`r") ($x + 10) ($y + 36) ($w - 20) ($h - 40) 8 $C.Ink $false | Out-Null
}

function Add-Relationship($slide, [double]$x1, [double]$y1, [double]$x2, [double]$y2, [string]$label = "") {
  $line = $slide.Shapes.AddLine($x1, $y1, $x2, $y2)
  $line.Line.ForeColor.RGB = $C.Cyan
  $line.Line.Weight = 1.6
  if ($label.Trim()) {
    Add-Text $slide $label (($x1 + $x2) / 2 - 32) (($y1 + $y2) / 2 - 12) 70 16 7 $C.Muted $false | Out-Null
  }
}

function Add-ScreenshotSlide($presentation, [int]$num, [string]$title, [string]$path, [string[]]$notes) {
  $slide = New-Slide $presentation "Demonstration V3" $num
  Add-Title $slide $title "Capture reelle de l'application locale V3."
  Add-ScreenshotCard $slide $path 50 135 620 350
  Add-Card $slide 700 145 205 320 $C.White $C.Border | Out-Null
  Add-Text $slide "Points a presenter" 720 166 160 22 15 $C.Blue $true | Out-Null
  Add-Bullets $slide $notes 720 205 160 230 11 | Out-Null
}

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = $msoTrue
$presentation = $ppt.Presentations.Add()
$presentation.PageSetup.SlideWidth = 960
$presentation.PageSetup.SlideHeight = 540

$n = 1

# Cover
$slide = $presentation.Slides.Add($n, $ppLayoutBlank)
$bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
$bg.Fill.ForeColor.RGB = $C.Bg
$bg.Line.Visible = $msoFalse
if (Test-Path $Logo) { Add-ImageFit $slide $Logo 54 42 180 70 | Out-Null }
Add-Text $slide "Projet de Fin d'Etudes" 54 128 420 24 15 $C.Cyan $true | Out-Null
Add-Text $slide "Focal V3" 54 162 420 44 34 $C.Navy $true | Out-Null
Add-Text $slide "Plateforme omnicanale d'assistance operationnelle et de gestion des connaissances" 54 212 480 74 21 $C.Ink $true | Out-Null
Add-Text $slide "Cycle d'ingenieur | ISMAGI | 2025 - 2026" 54 306 420 22 13 $C.Muted $false | Out-Null
Add-Text $slide "Realise par : Abdelfattah AZELMADI" 54 344 390 24 15 $C.Navy $true | Out-Null
Add-ScreenshotCard $slide (Join-Path $ShotDir "02-command-center.png") 520 78 360 230
Add-Card $slide 520 330 360 110 $C.White $C.Border | Out-Null
Add-Text $slide "Objectif de soutenance" 542 354 310 20 15 $C.Blue $true | Out-Null
Add-Text $slide "Demontrer une solution full stack riche, modulaire, securisee et adaptee aux operations d'une fintech." 542 384 300 44 13 $C.Ink $false | Out-Null
$n++

$slide = New-Slide $presentation "Structure" $n
Add-Title $slide "Sommaire detaille" "Le deck suit la structure academique demandee et ajoute des diagrammes exploitables."
Add-Bullets $slide @(
  "Contexte, problematique, objectifs et cahier des charges.",
  "Solution proposee, stack technique et conception UX/UI.",
  "Diagrammes : cas d'utilisation, classes, sequences, donnees, architecture.",
  "Implementation : frontend, backend, APIs, securite, integrabilite.",
  "Demonstration : une slide par page V3 avec capture reelle.",
  "Difficultes, resultats, limites, perspectives, conclusion."
) 82 165 805 235 18 | Out-Null
$n++

$slide = New-Slide $presentation "Contexte" $n
Add-Title $slide "Contexte du projet" "Une fintech doit traiter vite, juste, et de maniere tracable."
Add-Stat $slide "Support" "Demandes clients multi-sujets" 78 165 $C.Blue
Add-Stat $slide "Knowledge" "Procedures et articles critiques" 290 165 $C.Cyan
Add-Stat $slide "Quality" "Controle QA et supervision" 502 165 $C.Green
Add-Stat $slide "AI" "Assistance agent controlee" 714 165 $C.Orange
Add-Bullets $slide @(
  "La qualite de reponse depend de l'acces rapide a la bonne procedure.",
  "Les outils disperses ralentissent les agents et compliquent le pilotage.",
  "Le support fintech demande securite, auditabilite, coherence et scalabilite."
) 100 305 760 108 18 | Out-Null
$n++

$slide = New-Slide $presentation "Problematique" $n
Add-Title $slide "Problematique" "Industrialiser le support client sans sacrifier la qualite."
Add-Card $slide 78 160 805 180 $C.White $C.Border | Out-Null
Add-Text $slide "Comment concevoir une plateforme centralisee capable d'ameliorer la productivite du support client tout en garantissant la qualite, la tracabilite, la coherence des reponses et l'adaptabilite aux processus internes d'une fintech ?" 122 202 720 82 22 $C.Navy $true | Out-Null
Add-Bullets $slide @("Temps de traitement", "Coherence des reponses", "Suivi manageriel", "Securite des acces", "Scalabilite") 125 375 690 80 15 | Out-Null
$n++

$slide = New-Slide $presentation "Objectifs" $n
Add-Title $slide "Objectifs" "Faire converger operations, connaissance, IA et pilotage dans un seul outil."
Add-Bullets $slide @(
  "Centraliser CRM, KB, Magic Assistance, QA, formations, collaboration et escalade.",
  "Permettre aux agents de repondre plus vite avec des procedures fiables.",
  "Donner aux superviseurs des analytics exploitables par agent et article.",
  "Gerer les droits et roles sans modification du code.",
  "Integrer des canaux modernes : live chat, chatbots publics, Gmail, Jira.",
  "Preparer une evolution SaaS ou self-hosted avec Docker et architecture modulaire."
) 78 155 820 250 18 | Out-Null
$n++

$slide = New-Slide $presentation "Analyse" $n
Add-Title $slide "Analyse des besoins" "Les acteurs ont des besoins differents mais un meme environnement de travail."
Add-Flow $slide @("Agent", "Team Leader", "QA", "Admin", "OPS") 70 155 820 $C.White
Add-Bullets $slide @(
  "Agent : CRM, KB, Magic Assistance, formations, chat assigne.",
  "Team Leader : equipe, adherence, tickets, performance.",
  "QA : evaluation des interactions et feedbacks.",
  "Admin : comptes, acces, builders, configurations, integrations.",
  "OPS/Head of CS : supervision globale, analytics, amelioration continue."
) 92 278 770 140 17 | Out-Null
$n++

$slide = New-Slide $presentation "Cahier des charges" $n
Add-Title $slide "Cahier des charges" "Exigences fonctionnelles et non fonctionnelles prioritaires."
Add-Card $slide 58 150 410 278 $C.White $C.Border | Out-Null
Add-Text $slide "Fonctionnel" 84 174 260 22 20 $C.Blue $true | Out-Null
Add-Bullets $slide @("Authentification et roles", "CRM email et tickets", "Knowledge Base et SOP maps", "Magic Assistance", "Collaboration et Live Chat", "Academy, QA, adherence", "Escalade L1/L2 et Jira") 84 214 330 170 14 | Out-Null
Add-Card $slide 500 150 410 278 $C.White $C.Border | Out-Null
Add-Text $slide "Non fonctionnel" 526 174 260 22 20 $C.Cyan $true | Out-Null
Add-Bullets $slide @("Securite JWT", "Controle serveur des acces", "WebSocket temps reel", "Base relationnelle", "Dockerisation", "Modularite Angular/Spring", "Extensibilite IA et canaux") 526 214 330 170 14 | Out-Null
$n++

$slide = New-Slide $presentation "Existant" $n
Add-Title $slide "Etude de l'existant" "Positionnement par rapport aux outils du marche."
Add-Bullets $slide @(
  "Zendesk : tres complet pour support, mais personnalisation avancee couteuse.",
  "Helpjuice : excellent pour la knowledge base, moins centre operations internes.",
  "Slack : puissant en collaboration, mais pas lie nativement aux SOP, QA et tickets.",
  "Jira : tres adapte aux equipes techniques, moins naturel pour les agents L1.",
  "Focal V3 : approche unifiee : support + knowledge + process + QA + AI + escalation."
) 82 155 820 215 18 | Out-Null
$n++

$slide = New-Slide $presentation "Solution" $n
Add-Title $slide "Solution proposee" "Un cockpit operationnel V3 autour des processus de support."
Add-ScreenshotCard $slide (Join-Path $ShotDir "02-command-center.png") 510 140 370 250
Add-Bullets $slide @(
  "Un shell unique pour tous les modules.",
  "Navigation par sections : Workspace, Academy, Build, Manage, Delivery.",
  "Acces conditionnels par role et par fonctionnalite.",
  "Builders visuels pour adapter les processus sans redeployer.",
  "Mesure d'usage et feedback pour amelioration continue."
) 72 160 385 190 16 | Out-Null
$n++

$slide = New-Slide $presentation "Technologies" $n
Add-Title $slide "Technologies utilisees" "Stack moderne, lisible et deployable."
Add-Flow $slide @("Angular 21", "Spring Boot 4", "REST APIs", "WebSocket", "MySQL", "Docker") 42 158 875 $C.White
Add-Bullets $slide @(
  "Angular : composants standalone, lazy loading, services HTTP, routing V3.",
  "Spring Boot : controllers, services, repositories, security, websocket.",
  "MySQL/MariaDB : donnees metier, logs, historiques, relations.",
  "Integrations : Gmail OAuth, Jira REST, OpenAI, chat public.",
  "DevOps : Dockerfiles frontend/backend, Docker Compose, guide Oracle Cloud."
) 86 290 790 132 16 | Out-Null
$n++

$slide = New-Slide $presentation "Conception" $n
Add-Title $slide "Conception UX/UI" "V3 reprend une logique SaaS propre, lisible et orientee action."
Add-ScreenshotCard $slide (Join-Path $ShotDir "27-role-access-map.png") 520 135 360 270
Add-Bullets $slide @(
  "Sidebar constante pour garder les reperes.",
  "Topbar globale pour recherche, langue, timezone et statut.",
  "Maps : canvas, cartes, connecteurs, inspecteurs, zoom et pan.",
  "Animations appliquees au contenu, pas aux barres de navigation.",
  "Direction graphique : bleu confiance, turquoise technique, espaces aeres."
) 70 155 390 210 16 | Out-Null
$n++

# Use cases
$slide = New-Slide $presentation "Diagrammes" $n
Add-Title $slide "Diagramme de cas d'utilisation - Vue globale" "Les cas d'utilisation sont regroupes par famille d'acteurs."
Add-Flow $slide @("Client public", "Agent", "Supervisor", "Admin") 80 155 800 $C.SoftBlue
Add-Bullets $slide @(
  "Client public : demarrer chat, suivre workflow, escalader, donner CSAT.",
  "Agent : traiter CRM, consulter KB, utiliser Magic Assistance, suivre formations.",
  "Supervisor : consulter QA, adherence, KB analytics, tickets equipe.",
  "Admin : creer comptes, gerer acces, builders, articles, prompts, projets chat."
) 90 285 780 135 17 | Out-Null
$n++

$slide = New-Slide $presentation "Diagrammes" $n
Add-Title $slide "Diagramme de cas d'utilisation - Detail" "Relation entre modules et objectifs metier."
Add-Card $slide 52 150 250 250 $C.White $C.Border | Out-Null
Add-Text $slide "Agent" 76 174 160 20 18 $C.Blue $true | Out-Null
Add-Bullets $slide @("Repondre email", "Ajouter note interne", "Choisir tag", "Consulter SOP", "Demander aide IA") 76 212 190 130 12 | Out-Null
Add-Card $slide 354 150 250 250 $C.White $C.Border | Out-Null
Add-Text $slide "Supervision" 378 174 160 20 18 $C.Cyan $true | Out-Null
Add-Bullets $slide @("Evaluer QA", "Suivre temps article", "Voir adherence", "Analyser tickets", "Piloter equipe") 378 212 190 130 12 | Out-Null
Add-Card $slide 656 150 250 250 $C.White $C.Border | Out-Null
Add-Text $slide "Administration" 680 174 160 20 18 $C.Green $true | Out-Null
Add-Bullets $slide @("Gerer roles", "Creer articles", "Construire maps", "Configurer prompts", "Gerer users") 680 212 190 130 12 | Out-Null
$n++

# Class diagrams
$slide = New-Slide $presentation "Diagrammes" $n
Add-Title $slide "Diagramme de classes - Vue d'ensemble" "Le modele est decoupe par domaines pour rester lisible."
Add-Flow $slide @("Identity", "Knowledge", "CRM", "Collaboration", "Live Chat", "AI", "Training", "Ops") 35 150 890 $C.White
Add-Bullets $slide @(
  "Les classes d'entites sont stockees cote backend en JPA.",
  "Chaque domaine possede controllers, services et repositories dedies.",
  "Les relations principales : User -> Roles/Status/Assignments, Article -> Maps/Tracking/Feedback, ChatProject -> Workflow/Queue/Sessions.",
  "Les diagrammes suivants deploient les classes par domaine pour eviter un schema illisible."
) 78 285 820 130 16 | Out-Null
$n++

$slide = New-Slide $presentation "Classes" $n
Add-Title $slide "Diagramme de classes - Identity & Access" "Gestion des utilisateurs, roles, droits et presence."
Add-ClassBox $slide "User" @("id", "firstName", "lastName", "email", "password", "role", "active", "timeZone", "status") 55 150 190 110 $C.Blue
Add-ClassBox $slide "UserStatus" @("id", "userId", "status", "updatedAt") 290 150 180 95 $C.Cyan
Add-ClassBox $slide "UserStatusHistory" @("id", "userId", "fromStatus", "toStatus", "createdAt") 515 150 190 100 $C.Cyan
Add-ClassBox $slide "RoleAccessProfile" @("id", "roleKey", "label", "active") 55 315 190 95 $C.Green
Add-ClassBox $slide "RoleAccessLink" @("id", "roleKey", "featureKey", "enabled") 290 315 190 95 $C.Green
Add-ClassBox $slide "TeamLink" @("id", "agentId", "tlId", "qaId") 515 315 190 95 $C.Orange
Add-ClassBox $slide "UserSettings" @("language", "timezone", "jira", "notifications") 738 230 170 95 $C.Blue
Add-Relationship $slide 245 202 290 202 "1..1"
Add-Relationship $slide 470 202 515 202 "1..N"
Add-Relationship $slide 245 363 290 363 "role"
Add-Relationship $slide 705 360 738 280 "prefs"
$n++

$slide = New-Slide $presentation "Classes" $n
Add-Title $slide "Diagramme de classes - Knowledge & Decision" "Articles, categories, SOP maps, Magic Assistance et tags."
Add-ClassBox $slide "KbCategory" @("id", "name", "displayOrder") 48 145 170 92 $C.Blue
Add-ClassBox $slide "KbArticle" @("id", "categoryId", "title", "contentHtml", "active") 260 145 190 105 $C.Blue
Add-ClassBox $slide "KbMapNode" @("id", "articleId", "title", "contentHtml", "x", "y") 495 145 190 105 $C.Cyan
Add-ClassBox $slide "KbMapEdge" @("id", "sourceNodeId", "targetNodeId", "label") 725 145 180 95 $C.Cyan
Add-ClassBox $slide "KbArticleTimeLog" @("id", "articleId", "userId", "seconds", "source") 48 315 190 100 $C.Green
Add-ClassBox $slide "Page" @("id", "title", "content", "tag") 280 315 170 90 $C.Orange
Add-ClassBox $slide "Choice" @("id", "label", "sourcePageId", "targetPageId") 495 315 190 95 $C.Orange
Add-ClassBox $slide "CaseTagNode/Edge" @("id", "label", "parent", "target") 725 315 180 90 $C.Green
Add-Relationship $slide 218 192 260 192 "1..N"
Add-Relationship $slide 450 197 495 197 "1..N"
Add-Relationship $slide 685 197 725 197 "links"
Add-Relationship $slide 450 360 495 360 "choices"
$n++

$slide = New-Slide $presentation "Classes" $n
Add-Title $slide "Diagramme de classes - CRM & Communication" "Emails, conversations, notes internes, tags et pieces jointes."
Add-ClassBox $slide "CemContact" @("id", "name", "email", "phone") 55 145 170 90 $C.Blue
Add-ClassBox $slide "CemConversation" @("id", "contactId", "subject", "status", "assignee") 270 145 200 105 $C.Blue
Add-ClassBox $slide "CemInternalNote" @("id", "conversationId", "authorId", "content", "createdAt") 515 145 200 105 $C.Cyan
Add-ClassBox $slide "GmailAccount" @("id", "email", "accessToken", "refreshToken", "expiresAt") 740 145 170 105 $C.Green
Add-ClassBox $slide "ChatChannelLink" @("id", "provider", "externalId", "active") 55 320 180 90 $C.Orange
Add-ClassBox $slide "ChatConversation" @("id", "channel", "customer", "status") 285 320 180 90 $C.Orange
Add-ClassBox $slide "ChatMessage" @("id", "conversationId", "sender", "body", "sentAt") 515 320 190 100 $C.Orange
Add-ClassBox $slide "ChatParticipant" @("id", "conversationId", "userId", "role") 740 320 170 90 $C.Orange
Add-Relationship $slide 225 190 270 190 "1..N"
Add-Relationship $slide 470 195 515 195 "notes"
Add-Relationship $slide 465 365 515 365 "messages"
Add-Relationship $slide 705 365 740 365 "members"
$n++

$slide = New-Slide $presentation "Classes" $n
Add-Title $slide "Diagramme de classes - Collaboration & Live Chat" "Canaux internes, projets chat, queues et sessions."
Add-ClassBox $slide "CollaborationRoom" @("id", "name", "type", "createdBy") 45 135 175 92 $C.Blue
Add-ClassBox $slide "CollaborationRoomMember" @("roomId", "userId", "role", "joinedAt") 255 135 190 95 $C.Blue
Add-ClassBox $slide "CollaborationMessage" @("id", "roomId", "authorId", "body", "createdAt") 480 135 195 100 $C.Blue
Add-ClassBox $slide "MessageReaction/Mention" @("messageId", "userId", "type") 715 135 185 90 $C.Blue
Add-ClassBox $slide "ChatProject" @("id", "name", "slug", "status", "api") 45 310 175 100 $C.Cyan
Add-ClassBox $slide "ChatWorkflow" @("projectId", "status", "publishedAt") 255 310 190 90 $C.Cyan
Add-ClassBox $slide "ChatWorkflowNode" @("id", "type", "payload", "x", "y") 480 310 195 100 $C.Cyan
Add-ClassBox $slide "ChatWorkflowConnection" @("source", "target", "optionKey") 715 310 185 90 $C.Cyan
Add-Relationship $slide 220 180 255 180 "members"
Add-Relationship $slide 445 180 480 180 "messages"
Add-Relationship $slide 675 180 715 180 "reacts"
Add-Relationship $slide 220 355 255 355 "workflow"
Add-Relationship $slide 445 355 480 355 "nodes"
Add-Relationship $slide 675 355 715 355 "edges"
$n++

$slide = New-Slide $presentation "Classes" $n
Add-Title $slide "Diagramme de classes - Live Chat Routing" "Affectation agent et isolation des projets chat."
Add-ClassBox $slide "ChatQueue" @("id", "projectId", "name", "status") 60 150 180 92 $C.Cyan
Add-ClassBox $slide "ChatQueueAgent" @("queueId", "userId", "priority", "active") 285 150 190 92 $C.Cyan
Add-ClassBox $slide "LiveChatSession" @("id", "projectId", "queueId", "status", "customer") 525 150 210 105 $C.Blue
Add-ClassBox $slide "LiveChatAssignment" @("sessionId", "agentId", "assignedAt", "closedAt") 60 325 200 96 $C.Green
Add-ClassBox $slide "LiveChatMessage" @("sessionId", "senderType", "body", "createdAt") 315 325 200 96 $C.Green
Add-ClassBox $slide "WorkflowExecution" @("sessionId", "currentNodeId", "variables", "state") 570 325 205 96 $C.Orange
Add-Relationship $slide 240 195 285 195 "agents"
Add-Relationship $slide 475 195 525 195 "routes"
Add-Relationship $slide 260 373 315 373 "messages"
Add-Relationship $slide 735 207 672 325 "exec"
$n++

$slide = New-Slide $presentation "Classes" $n
Add-Title $slide "Diagramme de classes - AI, Training, QA & Ops" "Classes liees a l'assistance IA, formation, qualite et escalade."
Add-ClassBox $slide "ProcessAssistantConversation" @("id", "userId", "title", "profileId") 50 145 210 96 $C.Blue
Add-ClassBox $slide "ProcessAssistantMessage" @("conversationId", "role", "content", "createdAt") 305 145 210 96 $C.Blue
Add-ClassBox $slide "PromptProfile/RoleLink" @("prompt", "model", "apiKey", "role") 560 145 190 96 $C.Cyan
Add-ClassBox $slide "TrainingAsset" @("id", "type", "path", "duration", "owner") 50 315 185 96 $C.Green
Add-ClassBox $slide "QaEvaluation" @("id", "ticketId", "agentId", "score", "comments") 275 315 190 96 $C.Green
Add-ClassBox $slide "EscalationTicket" @("id", "clientId", "priority", "status", "jiraKey") 505 315 205 100 $C.Orange
Add-ClassBox $slide "EscalationComment" @("ticketId", "authorId", "body", "createdAt") 750 315 160 96 $C.Orange
Add-Relationship $slide 260 192 305 192 "messages"
Add-Relationship $slide 515 192 560 192 "prompt"
Add-Relationship $slide 710 365 750 365 "comments"
$n++

# Sequence diagrams
$slide = New-Slide $presentation "Sequences" $n
Add-Title $slide "Diagramme de sequence - Login et acces V3" "Le token JWT controle les appels API et les routes protegees."
Add-Flow $slide @("Utilisateur", "Login Angular", "Auth API", "JWT", "V3 Shell", "RoleGuard") 55 165 850 $C.White
Add-Bullets $slide @(
  "1. L'utilisateur saisit identifiant et mot de passe.",
  "2. Angular appelle /auth/login.",
  "3. Spring Security valide les credentials et retourne le token JWT.",
  "4. Le shell V3 charge le profil, le role, la langue, le statut et les droits.",
  "5. RoleGuard bloque les pages non autorisees."
) 88 300 800 120 16 | Out-Null
$n++

$slide = New-Slide $presentation "Sequences" $n
Add-Title $slide "Diagramme de sequence - Lecture article et analytics" "Le module KB mesure l'usage reel de la connaissance."
Add-Flow $slide @("Agent", "Knowledge Base", "KbArticle API", "Timer", "KbAnalytics API", "Dashboard") 45 165 870 $C.White
Add-Bullets $slide @(
  "1. L'agent selectionne un article.",
  "2. L'article et sa carte SOP sont charges.",
  "3. Un heartbeat enregistre le temps passe.",
  "4. Le feedback like/dislike est associe a l'article.",
  "5. KB Analytics consolide les temps par agent et article."
) 88 300 800 120 16 | Out-Null
$n++

$slide = New-Slide $presentation "Sequences" $n
Add-Title $slide "Diagramme de sequence - Public Chat vers agent" "Workflow bot, queue routing et live chat agent."
Add-Flow $slide @("Client", "Public Chat", "Workflow", "Queue", "Assignment", "Agent") 45 165 870 $C.White
Add-Bullets $slide @(
  "1. Le client ouvre /chat/{slug}.",
  "2. Le workflow execute les noeuds : choix, texte, booleen ou message.",
  "3. Une escalade selectionne une queue projet.",
  "4. L'agent disponible avec le moins de chats actifs est choisi.",
  "5. Le live chat continue en WebSocket jusqu'a cloture et CSAT."
) 88 300 800 120 16 | Out-Null
$n++

$slide = New-Slide $presentation "Sequences" $n
Add-Title $slide "Diagramme de sequence - Escalade L1/L2 et Jira" "Un ticket L1 devient un travail L2 structure et eventuellement synchronise Jira."
Add-Flow $slide @("L1", "Escalation API", "Queue L2", "L2 Playlist", "Jira Bridge", "Status") 45 165 870 $C.White
Add-Bullets $slide @(
  "1. L1 cree un ticket avec Client ID, issues, priorite et description.",
  "2. Le ticket arrive dans la queue L2.",
  "3. Un L2 clique Play : le plus ancien ticket non assigne lui est verrouille.",
  "4. L2 ajoute commentaires et peut creer un ticket Jira via backend.",
  "5. La resolution est controlee par le statut interne et le statut Jira."
) 88 300 800 120 16 | Out-Null
$n++

# Data and architecture
$slide = New-Slide $presentation "Donnees" $n
Add-Title $slide "Modele de donnees" "La base est organisee par domaines pour rester extensible."
Add-Bullets $slide @(
  "User est au centre des acces, de la presence, des assignations, QA et settings.",
  "KbArticle est lie aux categories, maps, feedbacks et logs de temps.",
  "ChatProject isole workflows, queues, API keys et sessions publiques.",
  "EscalationTicket relie L1/L2 et Jira sans melanger CRM et delivery.",
  "ProcessAssistant separe conversations, messages et profils de prompt."
) 76 152 820 165 17 | Out-Null
Add-Flow $slide @("User", "Roles", "Modules", "Events", "Analytics") 90 350 760 $C.SoftCyan
$n++

$slide = New-Slide $presentation "Architecture" $n
Add-Title $slide "Architecture du systeme" "Separation frontend, backend, base et integrations."
Add-Flow $slide @("Angular V3", "REST API", "Spring Services", "JPA", "MySQL") 58 150 845 $C.White
Add-Flow $slide @("Public Chat", "WebSocket", "Live Chat", "Agent UI") 170 270 620 $C.SoftBlue
Add-Bullets $slide @(
  "Les secrets Gmail/OpenAI/Jira restent cote backend.",
  "Les modules frontend consomment des services HTTP typés.",
  "Les donnees sensibles sont protegees par JWT et RoleGuard + controles serveur.",
  "Docker facilite le deploiement local, VPS ou cloud."
) 110 392 740 90 14 | Out-Null
$n++

$slide = New-Slide $presentation "Architecture" $n
Add-Title $slide "Architecture de deploiement" "Cible Oracle Cloud Free Tier ou VPS client."
Add-Flow $slide @("HTTPS", "Reverse Proxy", "Angular SSR", "Spring API", "MySQL", "Volumes") 40 160 880 $C.White
Add-Bullets $slide @(
  "Nginx/Caddy pour TLS, proxy /api et /ws.",
  "Frontend SSR Node pour servir l'application.",
  "Backend Spring Boot pour REST, WebSocket et integrations.",
  "MySQL/MariaDB avec sauvegardes, volume persistant et restrictions reseau.",
  "Variables d'environnement pour secrets et configuration."
) 82 292 800 130 16 | Out-Null
$n++

$slide = New-Slide $presentation "Backend" $n
Add-Title $slide "Carte des APIs backend" "Endpoints regroupes par domaine metier."
Add-Bullets $slide @(
  "/auth/login : authentification.",
  "/api/kb, /api/kb-map, /api/kb/analytics : connaissance.",
  "/api/crm, /api/gmail, /api/case-tags : CRM et emails.",
  "/api/chat-projects, /api/public/chat, /api/live-chat : chatbot et live chat.",
  "/api/process-assistant : IA et prompts.",
  "/api/access-control, /api/staff, /api/settings : administration.",
  "/api/escalations, /api/jira : L1/L2 et Jira."
) 72 148 820 245 17 | Out-Null
$n++

$slide = New-Slide $presentation "Implementation" $n
Add-Title $slide "Developpement / Implementation" "Le projet combine implementation produit et logique d'exploitation."
Add-Bullets $slide @(
  "Frontend : composants Angular standalone, lazy-loaded routes, services par domaine.",
  "Backend : Spring Boot controllers, services metier, repositories JPA.",
  "Securite : JWT, guards, role access map, comptes actifs/desactives.",
  "Temps reel : WebSocket pour collaboration et live chat.",
  "Fichiers et medias : assets d'entrainement stockes cote serveur.",
  "Documentation : rapport PFE, guide Oracle Cloud, scripts de generation de slides."
) 78 155 820 240 18 | Out-Null
$n++

$slide = New-Slide $presentation "Fonctionnalites" $n
Add-Title $slide "Fonctionnalites principales" "Vue synthetique des fonctions demontrees."
Add-Bullets $slide @(
  "CRM Inbox : emails, tickets, notes internes, tags, pieces jointes.",
  "Knowledge Base : articles, cartes SOP, feedback, analytics d'usage.",
  "Magic Assistance : arbres de decision pour procedures agents.",
  "Process Copilot : assistant IA avec historique et prompts par role.",
  "Collaboration + Live Chat : messages internes et conversations client temps reel.",
  "Academy + QA + Adherence : formation, evaluation et pilotage.",
  "Role Access Map : acces configurables et evolutifs."
) 78 155 820 250 18 | Out-Null
$n++

# Demo screenshots
$screens = @(
  @("Login", "01-login.png", @("Acces securise", "Identifiants", "Animation login", "Theme V3")),
  @("Command Center", "02-command-center.png", @("Dashboard central", "Navigation V3", "Quick jumps", "Acces role-based")),
  @("Calendar", "03-calendar.png", @("Planification", "Vue calendrier", "Evenements", "Organisation equipe")),
  @("CRM Inbox", "04-crm-inbox.png", @("Tickets email", "Files et cas", "Statuts", "Travail agent")),
  @("CRM Ticket Detail", "05-crm-ticket-detail.png", @("Conversation", "Reponse agent", "Notes internes", "Piece jointe")),
  @("Magic Assistance", "06-magic-assistance.png", @("Arbre decision", "Guidage agent", "Processus", "Etapes")),
  @("Knowledge Base", "07-knowledge-base.png", @("Articles", "Categories", "Recherche", "SOP map")),
  @("KB Analytics", "08-kb-analytics.png", @("Temps lecture", "Agents", "Articles", "Usage")),
  @("Collaboration Hub", "09-collaboration-hub.png", @("Canaux", "DM", "Messages", "Notifications")),
  @("Chat Projects", "10-chat-projects.png", @("Projets chatbot", "Workflow", "Queues", "API key")),
  @("Live Chat", "11-live-chat.png", @("Sessions", "Conversation", "Assignation", "Agent")),
  @("Process Copilot", "12-process-assistant.png", @("Assistant IA", "Prompts", "Historique", "Roles")),
  @("Academy - My Trainings", "13-academy-home.png", @("Formations", "Progression", "Cours", "Certification")),
  @("Academy - Catalog", "14-academy-catalog.png", @("Catalogue", "Recherche", "Parcours", "Autoformation")),
  @("Academy - Course Viewer", "15-academy-course-viewer.png", @("Lecture cours", "Etapes", "Video", "Temps")),
  @("Academy - Certificate", "16-academy-certificate.png", @("Certificat", "Validation", "Reconnaissance", "Traçabilite")),
  @("Academy - Studio", "17-academy-studio.png", @("Creation cours", "Modules", "Contenu", "Publication")),
  @("Academy - Course Editor", "18-academy-course-editor.png", @("Edition", "Sections", "Video upload", "Quiz")),
  @("Academy - Analytics", "19-academy-analytics.png", @("Suivi temps", "Completion", "Agents", "Cours")),
  @("Staff Management", "20-staff-management.png", @("Comptes", "Roles", "Activation", "Reset password")),
  @("Tree Builder", "21-tree-builder.png", @("Noeuds", "Connecteurs", "Auto layout", "Save DB")),
  @("KB Map Builder", "22-kb-map-builder.png", @("SOP maps", "Article map", "Details", "Pan/zoom")),
  @("Case Tag Builder", "23-case-tag-builder.png", @("Typologies", "Categories", "Sous-categories", "Tags")),
  @("Prompt Map Builder", "24-prompt-map-builder.png", @("Prompts", "Roles", "API key", "LLM")),
  @("Article Management", "25-article-management.png", @("CRUD articles", "Categories", "Edition", "Publication")),
  @("Article Editor", "26-article-editor.png", @("Edition full page", "Contenu", "Rich editor", "Save")),
  @("Role Access Map", "27-role-access-map.png", @("Roles", "Features", "Liens", "Permissions")),
  @("Settings", "28-settings.png", @("Profil", "Mot de passe", "Jira", "Preferences")),
  @("Adherence Dashboard", "29-adherence-dashboard.png", @("Timeline", "Statuts", "Agents", "Supervision")),
  @("QA Evaluation", "30-qa-evaluation.png", @("Evaluation", "Scores", "Tickets", "Feedback")),
  @("Team Management", "31-team-management.png", @("Liens TL/QA", "Agents", "Map", "Organisation")),
  @("Channel Access Map", "32-channel-access-map.png", @("Canaux", "Invitations", "Acces", "Collaboration")),
  @("FlowDesk Board", "33-flowdesk-board.png", @("Board", "Delivery", "Tasks", "Suivi")),
  @("FlowDesk Backlog", "34-flowdesk-backlog.png", @("Backlog", "Priorites", "Demandes", "Planification")),
  @("FlowDesk Sprints", "35-flowdesk-sprints.png", @("Sprints", "Plan", "Execution", "Suivi")),
  @("FlowDesk Reports", "36-flowdesk-reports.png", @("Rapports", "KPI", "Analyse", "Delivery")),
  @("FlowDesk Escalations", "37-flowdesk-escalations.png", @("L1/L2", "Playlist", "Jira", "Resolution")),
  @("404 Page", "38-v3-not-found.png", @("Page systeme", "UX erreur", "Navigation", "Robustesse")),
  @("Article Not Found", "39-article-not-found.png", @("Erreur article", "Guidage", "Retour KB", "UX"))
)

foreach ($s in $screens) {
  Add-ScreenshotSlide $presentation $n $s[0] (Join-Path $ShotDir $s[1]) $s[2]
  $n++
}

# Final analysis slides
$slide = New-Slide $presentation "Retour d'experience" $n
Add-Title $slide "Difficultes rencontrees et solutions" "Les problemes rencontres renforcent la maturite technique du projet."
Add-Bullets $slide @(
  "Mise a jour Angular non reactive : listeners, state refresh et change detection.",
  "Integrations externes : Gmail token expiration, Jira CORS, OpenAI quota/API key.",
  "Builders visuels : alignement des connecteurs, pan/zoom, liaison de noeuds.",
  "Gestion des droits : passage d'une logique code a une logique DB configurable.",
  "Live chat : besoin de WebSocket et persistence DB pour eviter le local-only.",
  "Production : separation des secrets, Docker, reverse proxy et sauvegardes."
) 78 155 820 245 17 | Out-Null
$n++

$slide = New-Slide $presentation "Resultats" $n
Add-Title $slide "Resultats obtenus" "Un produit demonstrable qui couvre support, knowledge, operations et IA."
Add-Stat $slide "39" "Captures V3 integrees au deck" 90 165 $C.Blue
Add-Stat $slide "20+" "Modules/pages operationnels" 300 165 $C.Cyan
Add-Stat $slide "REST+WS" "APIs et temps reel" 510 165 $C.Green
Add-Stat $slide "Docker" "Deploiement prepare" 720 165 $C.Orange
Add-Bullets $slide @(
  "Navigation V3 coherente et professionnelle.",
  "Knowledge Base enrichie par analytics et feedback.",
  "Builders visuels reutilisables.",
  "Architecture full stack modulaire.",
  "Base solide pour PFE, demo client ou prototype SaaS."
) 105 310 760 110 16 | Out-Null
$n++

$slide = New-Slide $presentation "Limites" $n
Add-Title $slide "Limites du projet" "Points a consolider avant exploitation commerciale."
Add-Bullets $slide @(
  "Remplacer ddl-auto update par Flyway ou Liquibase.",
  "Ajouter tests unitaires, integration, E2E et tests de charge.",
  "Mettre en place observabilite : logs structures, metrics, alerting.",
  "Chiffrer les secrets et externaliser la configuration sensible.",
  "Renforcer les validations serveur pour chaque permission critique.",
  "Preparer backups, restauration et procedures d'exploitation."
) 78 155 820 240 18 | Out-Null
$n++

$slide = New-Slide $presentation "Perspectives" $n
Add-Title $slide "Perspectives d'amelioration" "Faire evoluer Focal vers une plateforme enterprise."
Add-Bullets $slide @(
  "SSO Keycloak, multi-tenancy, audit trail complet.",
  "RAG et recherche semantique sur la Knowledge Base.",
  "WhatsApp, Instagram, Messenger, Telegram et voice support.",
  "SLA, business hours, skills-based routing et macros.",
  "Kubernetes, CI/CD, monitoring et blue-green deployment.",
  "Portail client public : tickets, status, KB et CSAT."
) 78 155 820 240 18 | Out-Null
$n++

$slide = New-Slide $presentation "Conclusion" $n
Add-Title $slide "Conclusion" "Focal V3 est un projet full stack complet, orienté valeur métier."
Add-Card $slide 92 175 775 190 $C.White $C.Border | Out-Null
Add-Text $slide "Le projet demontre la capacite a concevoir une plateforme operationnelle complete : CRM, base de connaissance, SOP maps, IA, collaboration, live chat, formation, QA, adherence, roles et escalade. Il repond a une problematique concrete de support fintech et pose une base solide pour une industrialisation SaaS ou self-hosted." 128 214 705 92 20 $C.Navy $true | Out-Null
Add-Text $slide "Message cle : rendre les agents plus rapides, les reponses plus coherentes et le pilotage plus mesurable." 128 323 705 34 15 $C.Cyan $true | Out-Null
$n++

$slide = $presentation.Slides.Add($presentation.Slides.Count + 1, $ppLayoutBlank)
$bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
$bg.Fill.ForeColor.RGB = $C.Navy
$bg.Line.Visible = $msoFalse
Add-Text $slide "Questions ?" 80 155 700 68 48 $C.White $true | Out-Null
Add-Text $slide "Merci pour votre attention" 84 235 600 30 20 $C.Cyan $true | Out-Null
Add-Text $slide "Projet de Fin d'Etudes - Focal V3 - Abdelfattah AZELMADI" 84 420 760 24 13 (Rgb 210 220 240) $false | Out-Null

if (Test-Path $PptxOut) { Remove-Item $PptxOut -Force }
if (Test-Path $PdfOut) { Remove-Item $PdfOut -Force }

$presentation.SaveAs($PptxOut, $ppSaveAsOpenXMLPresentation)
$presentation.SaveAs($PdfOut, 32)
$presentation.Close()
$ppt.Quit()

Write-Output $PptxOut
Write-Output $PdfOut
