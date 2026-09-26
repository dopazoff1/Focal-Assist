from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape


OUT = Path(__file__).resolve().parent / "focal-assist-v3-class-diagram.drawio"


def attr_escape(value: str) -> str:
    return escape(value, {'"': "&quot;"})


DOMAINS = [
    (
        "Identity & Access",
        40,
        60,
        [
            ("User", ["- id: Long", "- email: String", "- passwordHash: String", "- fullName: String", "- role: String", "- active: boolean", "- status: String"], ["+ login()", "+ logout()", "+ updateProfile()", "+ changeStatus()", "+ hasAccess()"]),
            ("UserSettings", ["- id: Long", "- userId: Long", "- language: String", "- timezone: String", "- uiTheme: String", "- jiraBaseUrl: String"], ["+ updatePreferences()", "+ updateJiraSettings()", "+ changePassword()"]),
            ("UserStatus", ["- id: Long", "- userId: Long", "- status: String", "- updatedAt: DateTime"], ["+ setOnline()", "+ setAway()", "+ setOffline()"]),
            ("UserStatusHistory", ["- id: Long", "- userId: Long", "- fromStatus: String", "- toStatus: String", "- createdAt: DateTime"], ["+ recordChange()", "+ calculateDuration()"]),
            ("RoleAccessProfile", ["- id: Long", "- roleKey: String", "- label: String", "- active: boolean"], ["+ createRole()", "+ renameRole()", "+ activate()", "+ deactivate()"]),
            ("RoleAccessLink", ["- id: Long", "- roleKey: String", "- featureKey: String", "- enabled: boolean"], ["+ enableFeature()", "+ disableFeature()", "+ isAllowed()"]),
            ("TeamLink", ["- id: Long", "- agentId: Long", "- teamLeaderId: Long", "- qaId: Long"], ["+ linkAgentToTL()", "+ linkAgentToQA()", "+ removeLink()"]),
        ],
    ),
    (
        "Knowledge Base & SOP",
        330,
        60,
        [
            ("KbCategory", ["- id: Long", "- name: String", "- displayOrder: int", "- active: boolean"], ["+ addArticle()", "+ rename()", "+ reorder()"]),
            ("KbArticle", ["- id: Long", "- categoryId: Long", "- title: String", "- contentHtml: String", "- active: boolean", "- updatedAt: DateTime"], ["+ publish()", "+ archive()", "+ updateContent()", "+ trackView()"]),
            ("KbMapNode", ["- id: Long", "- articleId: Long", "- title: String", "- contentHtml: String", "- x: double", "- y: double"], ["+ move()", "+ rename()", "+ updateContent()"]),
            ("KbMapEdge", ["- id: Long", "- articleId: Long", "- sourceNodeId: Long", "- targetNodeId: Long", "- label: String"], ["+ connect()", "+ disconnect()"]),
            ("KbArticleTimeLog", ["- id: Long", "- userId: Long", "- articleId: Long", "- secondsSpent: int", "- viewedAt: DateTime"], ["+ startTracking()", "+ stopTracking()", "+ calculateDuration()"]),
            ("AstraKbArticleFeedback", ["- id: Long", "- userId: Long", "- articleId: Long", "- reaction: String", "- comment: String"], ["+ like()", "+ dislike()", "+ addComment()"]),
            ("AstraKbPublicTicket", ["- id: Long", "- articleId: Long", "- subject: String", "- status: String", "- createdAt: DateTime"], ["+ createTicket()", "+ updateStatus()"]),
            ("AstraLlmIntegration", ["- id: Long", "- provider: String", "- model: String", "- apiKey: String", "- active: boolean"], ["+ enable()", "+ disable()", "+ validate()"]),
        ],
    ),
    (
        "Magic Assistance & Tags",
        620,
        60,
        [
            ("Page", ["- id: Long", "- title: String", "- content: String", "- tag: String", "- active: boolean"], ["+ updateContent()", "+ addChoice()", "+ markAsEnd()"]),
            ("Choice", ["- id: Long", "- label: String", "- sourcePageId: Long", "- targetPageId: Long", "- displayOrder: int"], ["+ linkToPage()", "+ rename()", "+ reorder()"]),
            ("CaseTagNode", ["- id: Long", "- label: String", "- parentId: Long", "- active: boolean", "- displayOrder: int"], ["+ addChild()", "+ rename()", "+ archive()"]),
            ("CaseTagEdge", ["- id: Long", "- sourceNodeId: Long", "- targetNodeId: Long", "- label: String"], ["+ connect()", "+ disconnect()"]),
        ],
    ),
    (
        "CRM",
        910,
        60,
        [
            ("CemContact", ["- id: Long", "- name: String", "- email: String", "- phone: String"], ["+ updateContact()", "+ mergeContact()"]),
            ("CemConversation", ["- id: Long", "- subject: String", "- customerEmail: String", "- status: String", "- priority: String", "- assigneeId: Long"], ["+ assignToAgent()", "+ changeStatus()", "+ sendReply()", "+ addInternalNote()"]),
            ("CemInternalNote", ["- id: Long", "- conversationId: Long", "- authorId: Long", "- content: String", "- createdAt: DateTime"], ["+ createNote()", "+ editNote()", "+ deleteNote()"]),
            ("GmailAccount", ["- id: Long", "- email: String", "- accessToken: String", "- refreshToken: String", "- expiresAt: DateTime"], ["+ refreshToken()", "+ reconnect()", "+ disable()"]),
        ],
    ),
    (
        "Collaboration Hub",
        1200,
        60,
        [
            ("CollaborationRoom", ["- id: Long", "- name: String", "- type: String", "- topic: String", "- createdById: Long"], ["+ createChannel()", "+ inviteMember()", "+ updateTopic()", "+ archive()"]),
            ("CollaborationRoomMember", ["- id: Long", "- roomId: Long", "- userId: Long", "- role: String", "- joinedAt: DateTime"], ["+ joinRoom()", "+ leaveRoom()", "+ updateRole()"]),
            ("CollaborationMessage", ["- id: Long", "- roomId: Long", "- senderId: Long", "- body: String", "- createdAt: DateTime", "- editedAt: DateTime"], ["+ send()", "+ edit()", "+ delete()", "+ react()"]),
            ("CollaborationMessageMention", ["- id: Long", "- messageId: Long", "- userId: Long"], ["+ notifyUser()"]),
            ("CollaborationMessageReaction", ["- id: Long", "- messageId: Long", "- userId: Long", "- emoji: String"], ["+ addReaction()", "+ removeReaction()"]),
            ("CollaborationMessageArticle", ["- id: Long", "- messageId: Long", "- articleId: Long"], ["+ linkArticle()", "+ unlinkArticle()"]),
            ("CollaborationUserPreference", ["- id: Long", "- userId: Long", "- soundEnabled: boolean", "- notifications: boolean"], ["+ updatePreferences()"]),
        ],
    ),
    (
        "Chat Projects & Live Chat",
        1490,
        60,
        [
            ("ChatProject", ["- id: Long", "- name: String", "- slug: String", "- description: String", "- status: String", "- publicUrl: String"], ["+ activate()", "+ archive()", "+ duplicate()", "+ generatePublicUrl()"]),
            ("ChatProjectApiKey", ["- id: Long", "- projectId: Long", "- tokenHash: String", "- scope: String", "- active: boolean"], ["+ generateKey()", "+ revokeKey()", "+ validateKey()"]),
            ("ChatWorkflow", ["- id: Long", "- projectId: Long", "- status: String", "- version: int", "- publishedAt: DateTime"], ["+ saveDraft()", "+ publish()", "+ archive()"]),
            ("ChatWorkflowNode", ["- id: Long", "- workflowId: Long", "- type: String", "- message: String", "- x: double", "- y: double"], ["+ move()", "+ duplicate()", "+ updateSettings()"]),
            ("ChatWorkflowConnection", ["- id: Long", "- workflowId: Long", "- sourceNodeId: Long", "- targetNodeId: Long", "- label: String"], ["+ connect()", "+ disconnect()"]),
            ("ChatQueue", ["- id: Long", "- projectId: Long", "- name: String", "- status: String"], ["+ addAgent()", "+ removeAgent()", "+ archive()"]),
            ("ChatQueueAgent", ["- id: Long", "- queueId: Long", "- userId: Long", "- priority: int"], ["+ assignToQueue()", "+ removeFromQueue()"]),
            ("ChatWidgetConfig", ["- id: Long", "- projectId: Long", "- title: String", "- primaryColor: String"], ["+ updateBranding()", "+ publish()"]),
            ("LiveChatSession", ["- id: Long", "- projectId: Long", "- queueId: Long", "- customerName: String", "- status: String", "- assignedAgentId: Long"], ["+ startSession()", "+ assignAgent()", "+ closeSession()", "+ addMessage()"]),
            ("LiveChatMessage", ["- id: Long", "- sessionId: Long", "- senderType: String", "- senderId: Long", "- body: String", "- createdAt: DateTime"], ["+ send()", "+ markAsRead()", "+ editMessage()"]),
            ("LiveChatAssignment", ["- id: Long", "- sessionId: Long", "- agentId: Long", "- assignedAt: DateTime", "- active: boolean"], ["+ assign()", "+ release()"]),
            ("WorkflowExecution", ["- id: Long", "- sessionId: Long", "- currentNodeId: Long", "- variablesJson: String"], ["+ advance()", "+ pause()", "+ resume()"]),
        ],
    ),
    (
        "AI, Training, QA & Escalation",
        1780,
        60,
        [
            ("ProcessAssistantConversation", ["- id: Long", "- userId: Long", "- promptProfileId: Long", "- title: String", "- createdAt: DateTime"], ["+ createConversation()", "+ rename()", "+ addMessage()"]),
            ("ProcessAssistantMessage", ["- id: Long", "- conversationId: Long", "- role: String", "- content: String", "- createdAt: DateTime"], ["+ sendUserMessage()", "+ saveAiResponse()"]),
            ("ProcessAssistantPromptProfile", ["- id: Long", "- name: String", "- systemPrompt: String", "- model: String", "- apiKey: String"], ["+ updatePrompt()", "+ assignToRole()", "+ disable()"]),
            ("ProcessAssistantPromptRoleLink", ["- id: Long", "- promptProfileId: Long", "- roleKey: String", "- enabled: boolean"], ["+ linkRole()", "+ unlinkRole()"]),
            ("TrainingAsset", ["- id: Long", "- courseId: Long", "- type: String", "- filePath: String", "- durationSeconds: int"], ["+ upload()", "+ delete()", "+ getPreviewUrl()"]),
            ("QaEvaluation", ["- id: Long", "- agentId: Long", "- evaluatorId: Long", "- ticketId: Long", "- score: double", "- comment: String"], ["+ calculateScore()", "+ submit()", "+ updateFeedback()"]),
            ("EscalationTicket", ["- id: Long", "- ticketKey: String", "- clientId: String", "- title: String", "- status: String", "- l2AssigneeId: Long", "- jiraIssueKey: String"], ["+ assignToL2()", "+ changeStatus()", "+ createJiraTicket()", "+ closeAsDuplicate()"]),
            ("EscalationComment", ["- id: Long", "- ticketId: Long", "- authorId: Long", "- body: String", "- createdAt: DateTime"], ["+ addComment()", "+ editComment()"]),
        ],
    ),
]

RELATIONSHIPS = [
    ("User", "UserSettings", "Association", "1", "0..1", "none"),
    ("User", "UserStatus", "Association", "1", "1", "none"),
    ("User", "UserStatusHistory", "Association", "1", "*", "none"),
    ("RoleAccessProfile", "RoleAccessLink", "Association", "1", "*", "none"),
    ("User", "TeamLink", "Association", "1", "*", "none"),
    ("KbCategory", "KbArticle", "Aggregation", "1", "*", "aggregation"),
    ("KbArticle", "KbMapNode", "Composition", "1", "*", "composition"),
    ("KbArticle", "KbMapEdge", "Composition", "1", "*", "composition"),
    ("KbArticle", "KbArticleTimeLog", "Association", "1", "*", "none"),
    ("KbArticle", "AstraKbArticleFeedback", "Association", "1", "*", "none"),
    ("Page", "Choice", "Composition", "1", "*", "composition"),
    ("Choice", "Page", "Association", "*", "1", "none"),
    ("CemConversation", "CemInternalNote", "Composition", "1", "*", "composition"),
    ("CemConversation", "User", "Association", "*", "0..1", "none"),
    ("CemConversation", "CaseTagNode", "Dependency", "", "", "dependency"),
    ("CollaborationRoom", "CollaborationRoomMember", "Aggregation", "1", "*", "aggregation"),
    ("CollaborationRoom", "CollaborationMessage", "Composition", "1", "*", "composition"),
    ("CollaborationMessage", "User", "Association", "*", "1", "none"),
    ("ChatProject", "ChatWorkflow", "Composition", "1", "1", "composition"),
    ("ChatProject", "ChatQueue", "Aggregation", "1", "*", "aggregation"),
    ("ChatProject", "ChatProjectApiKey", "Composition", "1", "*", "composition"),
    ("ChatProject", "ChatWidgetConfig", "Composition", "1", "0..1", "composition"),
    ("ChatWorkflow", "ChatWorkflowNode", "Composition", "1", "*", "composition"),
    ("ChatWorkflow", "ChatWorkflowConnection", "Composition", "1", "*", "composition"),
    ("ChatQueue", "ChatQueueAgent", "Aggregation", "1", "*", "aggregation"),
    ("ChatQueueAgent", "User", "Association", "*", "1", "none"),
    ("LiveChatSession", "LiveChatMessage", "Composition", "1", "*", "composition"),
    ("LiveChatSession", "LiveChatAssignment", "Composition", "1", "*", "composition"),
    ("LiveChatAssignment", "User", "Association", "*", "1", "none"),
    ("ProcessAssistantConversation", "ProcessAssistantMessage", "Composition", "1", "*", "composition"),
    ("ProcessAssistantConversation", "ProcessAssistantPromptProfile", "Association", "*", "1", "none"),
    ("ProcessAssistantPromptProfile", "ProcessAssistantPromptRoleLink", "Association", "1", "*", "none"),
    ("QaEvaluation", "User", "Association", "*", "1", "none"),
    ("EscalationTicket", "EscalationComment", "Composition", "1", "*", "composition"),
    ("EscalationTicket", "User", "Association", "*", "1", "none"),
    ("EscalationTicket", "JiraIssue", "Dependency", "", "", "dependency"),
]


def cell(id_, value="", style="", parent="1", vertex=False, edge=False, source=None, target=None, geometry=None):
    attrs = [f'id="{id_}"']
    if value:
        attrs.append(f'value="{attr_escape(value)}"')
    if style:
        attrs.append(f'style="{attr_escape(style)}"')
    if parent:
        attrs.append(f'parent="{parent}"')
    if vertex:
        attrs.append('vertex="1"')
    if edge:
        attrs.append('edge="1"')
    if source:
        attrs.append(f'source="{source}"')
    if target:
        attrs.append(f'target="{target}"')
    if geometry:
        return f'<mxCell {" ".join(attrs)}>{geometry}</mxCell>'
    return f'<mxCell {" ".join(attrs)}/>'


def geometry(x=None, y=None, w=None, h=None, relative=False):
    if relative:
        return '<mxGeometry relative="1" as="geometry"/>'
    return f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'


def class_label(name, attrs, methods):
    attr_html = "<br>".join(escape(a) for a in attrs)
    meth_html = "<br>".join(escape(m) for m in methods)
    return (
        f'<div style="font-size:13px;font-weight:700;text-align:center;color:#091430;">{escape(name)}</div>'
        '<hr size="1">'
        f'<div style="font-size:11px;text-align:left;color:#182235;">{attr_html}</div>'
        '<hr size="1">'
        f'<div style="font-size:11px;text-align:left;color:#182235;">{meth_html}</div>'
    )


def main():
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    class_ids: dict[str, str] = {}
    next_id = 2
    class_w = 240
    class_h = 190
    row_gap = 26
    domain_w = 268

    for domain_name, x, y, classes in DOMAINS:
        panel_h = 54 + len(classes) * (class_h + row_gap) + 20
        cells.append(
            cell(
                f"d{next_id}",
                domain_name,
                "swimlane;whiteSpace=wrap;html=1;rounded=1;arcSize=8;startSize=34;fontStyle=1;fontSize=14;"
                "fillColor=#EAF1FF;strokeColor=#CAD8EA;fontColor=#091430;",
                vertex=True,
                geometry=geometry(x, y, domain_w, panel_h),
            )
        )
        next_id += 1
        cy = y + 50
        for name, attrs, methods in classes:
            cid = f"c{next_id}"
            class_ids[name] = cid
            cells.append(
                cell(
                    cid,
                    class_label(name, attrs, methods),
                    "rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#2E63EB;fontColor=#091430;"
                    "spacing=8;shadow=0;",
                    vertex=True,
                    geometry=geometry(x + 14, cy, class_w, class_h),
                )
            )
            next_id += 1
            cy += class_h + row_gap

    # External placeholder used by dependency edge.
    jira_id = f"c{next_id}"
    class_ids["JiraIssue"] = jira_id
    cells.append(
        cell(
            jira_id,
            class_label("JiraIssue", ["- key: String", "- status: String", "- url: String"], ["+ syncStatus()"]),
            "rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF7ED;strokeColor=#EA580C;fontColor=#091430;spacing=8;",
            vertex=True,
            geometry=geometry(2090, 1820, class_w, 140),
        )
    )
    next_id += 1

    for source, target, label, left_mult, right_mult, kind in RELATIONSHIPS:
        if source not in class_ids or target not in class_ids:
            continue
        style = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;fontSize=10;"
        style += "strokeColor=#091430;fontColor=#091430;"
        if kind == "aggregation":
            style += "startArrow=diamondThin;startFill=0;endArrow=none;"
        elif kind == "composition":
            style += "startArrow=diamondThin;startFill=1;endArrow=none;"
        elif kind == "dependency":
            style += "dashed=1;endArrow=open;endFill=0;"
        else:
            style += "endArrow=none;"
        value = f"{left_mult} {label} {right_mult}".strip()
        cells.append(
            cell(
                f"e{next_id}",
                value,
                style,
                edge=True,
                source=class_ids[source],
                target=class_ids[target],
                geometry=geometry(relative=True),
            )
        )
        next_id += 1

    model = (
        '<mxGraphModel dx="2200" dy="1400" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" '
        'arrows="1" fold="1" page="1" pageScale="1" pageWidth="2400" pageHeight="2600" math="0" shadow="0">'
        f'<root>{"".join(cells)}</root></mxGraphModel>'
    )
    xml = (
        '<mxfile host="app.diagrams.net" modified="2026-07-06T00:00:00.000Z" '
        'agent="Codex" version="24.7.17" type="device">'
        f'<diagram id="focal-assist-v3-class-diagram" name="Focal V3 Class Diagram">{model}</diagram>'
        '</mxfile>'
    )
    OUT.write_text(xml, encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()
