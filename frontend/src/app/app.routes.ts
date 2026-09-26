import { Routes } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { LoginGuard } from './login.guard';
import { RoleGuard } from './role.guard';

const loadLogin = () => import('./components/login/login').then(m => m.Login);
const loadLoginV2 = () => import('./components/login-v2/login-v2').then(m => m.LoginV2);
const loadMfaSetup = () => import('./components/mfa/mfa-setup').then(m => m.MfaSetupComponent);
const loadMfaChallenge = () => import('./components/mfa/mfa-challenge').then(m => m.MfaChallengeComponent);
const loadV4Login = () => import('./components/v4-login/v4-login').then(m => m.V4LoginComponent);
const loadV4Shell = () => import('./components/v4-shell/v4-shell').then(m => m.V4ShellComponent);
const loadV4Dashboard = () => import('./components/v4-dashboard/v4-dashboard').then(m => m.V4DashboardComponent);
const loadV4Pipeline = () => import('./components/v4-pipeline/v4-pipeline').then(m => m.V4PipelineComponent);
const loadV4Contacts = () => import('./components/v4-contacts/v4-contacts').then(m => m.V4ContactsComponent);
const loadV4Tasks = () => import('./components/v4-tasks/v4-tasks').then(m => m.V4TasksComponent);
const loadV4Notifications = () => import('./components/v4-notifications/v4-notifications').then(m => m.V4NotificationsComponent);
const loadV4Forms = () => import('./components/v4-forms/v4-forms').then(m => m.V4FormsComponent);
const loadV4DesignSystem = () => import('./components/v4-design-system/v4-design-system').then(m => m.V4DesignSystemComponent);
const loadV5Login = () => import('./components/v5-login/v5-login').then(m => m.V5LoginComponent);
const loadV5Shell = () => import('./components/v5-shell/v5-shell').then(m => m.V5ShellComponent);
const loadV5Dashboard = () => import('./components/v5-dashboard/v5-dashboard').then(m => m.V5DashboardComponent);
const loadV5Pipeline = () => import('./components/v5-pipeline/v5-pipeline').then(m => m.V5PipelineComponent);
const loadV5Contacts = () => import('./components/v5-contacts/v5-contacts').then(m => m.V5ContactsComponent);
const loadV5Tasks = () => import('./components/v5-tasks/v5-tasks').then(m => m.V5TasksComponent);
const loadV5Notifications = () => import('./components/v5-notifications/v5-notifications').then(m => m.V5NotificationsComponent);
const loadV5Forms = () => import('./components/v5-forms/v5-forms').then(m => m.V5FormsComponent);
const loadV5DesignSystem = () => import('./components/v5-design-system/v5-design-system').then(m => m.V5DesignSystemComponent);
const loadMarketingShell = () => import('./components/marketing-shell/marketing-shell').then(m => m.MarketingShell);
const loadMarketingHome = () => import('./components/marketing-home/marketing-home').then(m => m.MarketingHome);
const loadMarketingPlatform = () => import('./components/marketing-platform/marketing-platform').then(m => m.MarketingPlatform);
const loadMarketingSolutions = () => import('./components/marketing-solutions/marketing-solutions').then(m => m.MarketingSolutions);
const loadMarketingIntegrations = () => import('./components/marketing-integrations/marketing-integrations').then(m => m.MarketingIntegrations);
const loadMarketingPricing = () => import('./components/marketing-pricing/marketing-pricing').then(m => m.MarketingPricing);
const loadMarketingSecurity = () => import('./components/marketing-security/marketing-security').then(m => m.MarketingSecurity);
const loadMarketingCompare = () => import('./components/marketing-compare/marketing-compare').then(m => m.MarketingCompare);
const loadMarketingKnowledgeBase = () => import('./components/marketing-knowledge-base/marketing-knowledge-base').then(m => m.MarketingKnowledgeBase);
const loadV3Shell = () => import('./components/v3-shell/v3-shell').then(m => m.V3Shell);
const loadV3Home = () => import('./components/v3-home/v3-home').then(m => m.V3Home);
const loadMagicAssistance = () => import('./components/magic-assistance/magic-assistance').then(m => m.MagicAssistance);
const loadKnowledgeBase = () => import('./components/knowledge-base/knowledge-base').then(m => m.KnowledgeBase);
const loadKnowledgeHub = () => import('./components/knowledge-hub/knowledge-hub').then(m => m.KnowledgeHubComponent);
const loadKnowledgeHubCategory = () => import('./components/knowledge-hub/knowledge-hub-category').then(m => m.KnowledgeHubCategoryComponent);
const loadKnowledgeHubReader = () => import('./components/knowledge-hub/knowledge-hub-reader').then(m => m.KnowledgeHubReaderComponent);
const loadKbAnalyticsDashboard = () => import('./components/kb-analytics-dashboard/kb-analytics-dashboard').then(m => m.KbAnalyticsDashboardComponent);
const loadCrm = () => import('./components/crm/crm').then(m => m.Crm);
const loadCollaborationHub = () => import('./components/collaboration-hub/collaboration-hub').then(m => m.CollaborationHubComponent);
const loadChatProjects = () => import('./components/chat-projects/chat-projects').then(m => m.ChatProjectsComponent);
const loadLiveChat = () => import('./components/live-chat/live-chat').then(m => m.LiveChatComponent);
const loadPublicChat = () => import('./components/public-chat/public-chat').then(m => m.PublicChatComponent);
const loadTrainingHome = () => import('./components/training-home/training-home').then(m => m.TrainingHome);
const loadTrainingCatalog = () => import('./components/training-catalog/training-catalog').then(m => m.TrainingCatalog);
const loadTrainingStudio = () => import('./components/training-studio/training-studio').then(m => m.TrainingStudio);
const loadTrainingCourseEditor = () => import('./components/training-course-editor/training-course-editor').then(m => m.TrainingCourseEditor);
const loadTrainingCourseViewer = () => import('./components/training-course-viewer/training-course-viewer').then(m => m.TrainingCourseViewer);
const loadTrainingAnalytics = () => import('./components/training-analytics/training-analytics').then(m => m.TrainingAnalytics);
const loadTrainingCertificate = () => import('./components/training-certificate/training-certificate').then(m => m.TrainingCertificate);
const loadStaffManagement = () => import('./components/staff-management/staff-management').then(m => m.StaffManagement);
const loadTreeBuilder = () => import('./components/tree-builder/tree-builder').then(m => m.TreeBuilder);
const loadKbMapBuilder = () => import('./components/kb-map-builder/kb-map-builder').then(m => m.KbMapBuilder);
const loadCaseTagBuilder = () => import('./components/case-tag-builder/case-tag-builder').then(m => m.CaseTagBuilder);
const loadProcessAssistant = () => import('./components/process-assistant/process-assistant').then(m => m.ProcessAssistantComponent);
const loadPromptMapBuilder = () => import('./components/prompt-map-builder/prompt-map-builder').then(m => m.PromptMapBuilderComponent);
const loadArticleManagement = () => import('./components/article-management/article-management').then(m => m.ArticleManagement);
const loadArticleEditor = () => import('./components/article-editor/article-editor').then(m => m.ArticleEditor);
const loadArticleValidation = () => import('./components/article-validation/article-validation').then(m => m.ArticleValidationComponent);
const loadArticleValidationChainBuilder = () => import('./components/article-validation-chain-builder/article-validation-chain-builder').then(m => m.ArticleValidationChainBuilderComponent);
const loadAdherenceDashboard = () => import('./components/adherence-dashboard/adherence-dashboard').then(m => m.AdherenceDashboard);
const loadQaEvaluation = () => import('./components/qa-evaluation/qa-evaluation').then(m => m.QaEvaluationComponent);
const loadTeamManagement = () => import('./components/team-management/team-management').then(m => m.TeamManagementComponent);
const loadChannelAccessMap = () => import('./components/channel-access-map/channel-access-map').then(m => m.ChannelAccessMapComponent);
const loadRoleAccessMap = () => import('./components/role-access-map/role-access-map').then(m => m.RoleAccessMapComponent);
const loadUserSettings = () => import('./components/user-settings/user-settings').then(m => m.UserSettingsComponent);
const loadFlowdeskBoard = () => import('./components/flowdesk-board/flowdesk-board').then(m => m.FlowdeskBoard);
const loadFlowdeskBacklog = () => import('./components/flowdesk-backlog/flowdesk-backlog').then(m => m.FlowdeskBacklog);
const loadFlowdeskSprints = () => import('./components/flowdesk-sprints/flowdesk-sprints').then(m => m.FlowdeskSprints);
const loadFlowdeskReports = () => import('./components/flowdesk-reports/flowdesk-reports').then(m => m.FlowdeskReports);
const loadFlowdeskEscalations = () => import('./components/flowdesk-escalations/flowdesk-escalations').then(m => m.FlowdeskEscalations);
const loadAstraShell = () => import('./components/astra-shell/astra-shell').then(m => m.AstraShellComponent);
const loadAstraDashboard = () => import('./components/astra-dashboard/astra-dashboard').then(m => m.AstraDashboardComponent);
const loadAstraKnowledge = () => import('./components/astra-knowledge/astra-knowledge').then(m => m.AstraKnowledgeComponent);
const loadAstraTickets = () => import('./components/astra-tickets/astra-tickets').then(m => m.AstraTicketsComponent);
const loadAstraPublicKb = () => import('./components/astra-public-kb/astra-public-kb').then(m => m.AstraPublicKbComponent);
const loadAstraIntegrations = () => import('./components/astra-integrations/astra-integrations').then(m => m.AstraIntegrationsComponent);
const loadAstraHelpCenter = () => import('./components/astra-help-center/astra-help-center').then(m => m.AstraHelpCenterComponent);
const loadNotFound = () => import('./components/not-found/not-found').then(m => m.NotFoundComponent);
const loadArticleNotFound = () => import('./components/article-not-found/article-not-found').then(m => m.ArticleNotFoundComponent);

export const routes: Routes = [
  {
    path: 'help-center',
    loadComponent: loadMarketingShell,
    children: [
      { path: '', loadComponent: loadMarketingKnowledgeBase },
      { path: '**', redirectTo: '' }
    ]
  },
  {
    path: 'knowledge-base-public',
    loadComponent: loadMarketingShell,
    children: [
      { path: '', loadComponent: loadMarketingKnowledgeBase },
      { path: '**', redirectTo: '' }
    ]
  },
  {
    path: 'marketing',
    loadComponent: loadMarketingShell,
    children: [
      { path: '', loadComponent: loadMarketingHome },
      { path: 'kb', redirectTo: 'knowledge-base', pathMatch: 'full' },
      { path: 'help-center', redirectTo: 'knowledge-base', pathMatch: 'full' },
      { path: 'platform', loadComponent: loadMarketingPlatform },
      { path: 'solutions', loadComponent: loadMarketingSolutions },
      { path: 'integrations', loadComponent: loadMarketingIntegrations },
      { path: 'pricing', loadComponent: loadMarketingPricing },
      { path: 'security', loadComponent: loadMarketingSecurity },
      { path: 'knowledge-base', loadComponent: loadMarketingKnowledgeBase },
      { path: 'compare-zendesk', loadComponent: loadMarketingCompare },
      { path: '**', redirectTo: 'knowledge-base' }
    ]
  },
  { path: 'pricing', redirectTo: 'marketing/pricing', pathMatch: 'full' },
  { path: 'astra/help', loadComponent: loadAstraHelpCenter },
  { path: '404', loadComponent: loadNotFound },
  { path: 'article-not-found', loadComponent: loadArticleNotFound },
  // Main app defaults to V3.
  { path: '', redirectTo: 'v3/home', pathMatch: 'full' },
  { path: 'login', loadComponent: loadLogin, canActivate: [LoginGuard] },
  { path: 'loginv2', loadComponent: loadLoginV2, canActivate: [LoginGuard] },
  { path: 'mfa-setup', loadComponent: loadMfaSetup },
  { path: 'mfa-challenge', loadComponent: loadMfaChallenge },
  { path: 'chat/:slug', loadComponent: loadPublicChat },
  { path: 'v4/login', loadComponent: loadV4Login, canActivate: [LoginGuard] },
  { path: 'sales/login', loadComponent: loadV4Login, canActivate: [LoginGuard] },
  { path: 'v5/login', loadComponent: loadV5Login, canActivate: [LoginGuard] },
  {
    path: 'astra',
    loadComponent: loadAstraShell,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: loadAstraDashboard },
      { path: 'knowledge', loadComponent: loadAstraKnowledge },
      { path: 'tickets', loadComponent: loadAstraTickets },
      { path: 'public', loadComponent: loadAstraPublicKb },
      {
        path: 'integrations',
        loadComponent: loadAstraIntegrations,
        canActivate: [RoleGuard],
        data: { roles: ['ADMIN', 'HEAD_CS', 'OPS'] }
      },
      { path: '**', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'v4',
    loadComponent: loadV4Shell,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: loadV4Dashboard, data: { animation: 'dashboard' } },
      { path: 'pipeline', loadComponent: loadV4Pipeline, data: { animation: 'pipeline' } },
      { path: 'contacts', loadComponent: loadV4Contacts, data: { animation: 'contacts' } },
      { path: 'tasks', loadComponent: loadV4Tasks, data: { animation: 'tasks' } },
      { path: 'notifications', loadComponent: loadV4Notifications, data: { animation: 'notifications' } },
      { path: 'forms', loadComponent: loadV4Forms, data: { animation: 'forms' } },
      { path: 'design-system', loadComponent: loadV4DesignSystem, data: { animation: 'design-system' } },
      { path: '**', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'sales',
    loadComponent: loadV4Shell,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: loadV4Dashboard, data: { animation: 'dashboard' } },
      { path: 'pipeline', loadComponent: loadV4Pipeline, data: { animation: 'pipeline' } },
      { path: 'contacts', loadComponent: loadV4Contacts, data: { animation: 'contacts' } },
      { path: 'tasks', loadComponent: loadV4Tasks, data: { animation: 'tasks' } },
      { path: 'notifications', loadComponent: loadV4Notifications, data: { animation: 'notifications' } },
      { path: 'forms', loadComponent: loadV4Forms, data: { animation: 'forms' } },
      { path: 'design-system', loadComponent: loadV4DesignSystem, data: { animation: 'design-system' } },
      { path: '**', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'v5',
    loadComponent: loadV5Shell,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: loadV5Dashboard, data: { animation: 'dashboard' } },
      { path: 'pipeline', loadComponent: loadV5Pipeline, data: { animation: 'pipeline' } },
      { path: 'contacts', loadComponent: loadV5Contacts, data: { animation: 'contacts' } },
      { path: 'tasks', loadComponent: loadV5Tasks, data: { animation: 'tasks' } },
      { path: 'notifications', loadComponent: loadV5Notifications, data: { animation: 'notifications' } },
      { path: 'forms', loadComponent: loadV5Forms, data: { animation: 'forms' } },
      { path: 'design-system', loadComponent: loadV5DesignSystem, data: { animation: 'design-system' } },
      { path: '**', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // Legacy non-versioned routes are redirected to V3 equivalents.
  { path: 'home', redirectTo: 'v3/home', pathMatch: 'full' },
  { path: 'magic-assistance', redirectTo: 'v3/magic-assistance', pathMatch: 'full' },
  { path: 'calendar', redirectTo: 'v3/calendar', pathMatch: 'full' },
  { path: 'knowledge-base', redirectTo: 'v3/knowledge-base', pathMatch: 'full' },
  { path: 'kb-analytics', redirectTo: 'v3/kb-analytics', pathMatch: 'full' },
  { path: 'collaboration', redirectTo: 'v3/collaboration', pathMatch: 'full' },
  { path: 'chat-projects', redirectTo: 'v3/chat-projects', pathMatch: 'full' },
  { path: 'live-chat', redirectTo: 'v3/live-chat', pathMatch: 'full' },
  { path: 'process-assistant', redirectTo: 'v3/process-assistant', pathMatch: 'full' },
  { path: 'crm', redirectTo: 'v3/crm', pathMatch: 'full' },
  { path: 'crm/ticket/:ticketId', redirectTo: 'v3/crm/ticket/:ticketId', pathMatch: 'full' },
  { path: 'academy', redirectTo: 'v3/academy', pathMatch: 'full' },
  { path: 'academy/catalog', redirectTo: 'v3/academy/catalog', pathMatch: 'full' },
  { path: 'academy/studio', redirectTo: 'v3/academy/studio', pathMatch: 'full' },
  { path: 'academy/studio/course/:id', redirectTo: 'v3/academy/studio/course/:id', pathMatch: 'full' },
  { path: 'academy/analytics', redirectTo: 'v3/academy/analytics', pathMatch: 'full' },
  { path: 'academy/course/:id/certificate', redirectTo: 'v3/academy/course/:id/certificate', pathMatch: 'full' },
  { path: 'academy/course/:id', redirectTo: 'v3/academy/course/:id', pathMatch: 'full' },
  { path: 'staff-management', redirectTo: 'v3/staff-management', pathMatch: 'full' },
  { path: 'tree-builder', redirectTo: 'v3/tree-builder', pathMatch: 'full' },
  { path: 'kb-map-builder', redirectTo: 'v3/kb-map-builder', pathMatch: 'full' },
  { path: 'case-tag-builder', redirectTo: 'v3/case-tag-builder', pathMatch: 'full' },
  { path: 'prompt-map-builder', redirectTo: 'v3/prompt-map-builder', pathMatch: 'full' },
  { path: 'article-management', redirectTo: 'v3/article-management', pathMatch: 'full' },
  { path: 'article-management/edit/:id', redirectTo: 'v3/article-management/edit/:id', pathMatch: 'full' },
  { path: 'article-validation', redirectTo: 'v3/article-validation', pathMatch: 'full' },
  { path: 'role-access-map', redirectTo: 'v3/role-access-map', pathMatch: 'full' },
  { path: 'settings', redirectTo: 'v3/settings', pathMatch: 'full' },
  { path: 'adherence-dashboard', redirectTo: 'v3/adherence-dashboard', pathMatch: 'full' },
  { path: 'qa-evaluation', redirectTo: 'v3/qa-evaluation', pathMatch: 'full' },
  { path: 'team-management', redirectTo: 'v3/team-management', pathMatch: 'full' },
  { path: 'channel-access-map', redirectTo: 'v3/channel-access-map', pathMatch: 'full' },
  { path: 'flowdesk', redirectTo: 'v3/flowdesk/board', pathMatch: 'full' },
  { path: 'flowdesk/board', redirectTo: 'v3/flowdesk/board', pathMatch: 'full' },
  { path: 'flowdesk/backlog', redirectTo: 'v3/flowdesk/backlog', pathMatch: 'full' },
  { path: 'flowdesk/sprints', redirectTo: 'v3/flowdesk/sprints', pathMatch: 'full' },
  { path: 'flowdesk/reports', redirectTo: 'v3/flowdesk/reports', pathMatch: 'full' },
  { path: 'flowdesk/escalations', redirectTo: 'v3/flowdesk/escalations', pathMatch: 'full' },

  // V2 URLs are kept only as redirects to V3 for backward compatibility.
  {
    path: 'v2',
    children: [
      { path: '', redirectTo: '/v3/home', pathMatch: 'full' },
      { path: 'home', redirectTo: '/v3/home', pathMatch: 'full' },
      { path: 'magic-assistance', redirectTo: '/v3/magic-assistance', pathMatch: 'full' },
      { path: 'calendar', redirectTo: '/v3/calendar', pathMatch: 'full' },
      { path: 'knowledge-base', redirectTo: '/v3/knowledge-base', pathMatch: 'full' },
      { path: 'kb-analytics', redirectTo: '/v3/kb-analytics', pathMatch: 'full' },
      { path: 'collaboration', redirectTo: '/v3/collaboration', pathMatch: 'full' },
      { path: 'chat-projects', redirectTo: '/v3/chat-projects', pathMatch: 'full' },
      { path: 'live-chat', redirectTo: '/v3/live-chat', pathMatch: 'full' },
      { path: 'process-assistant', redirectTo: '/v3/process-assistant', pathMatch: 'full' },
      { path: 'crm', redirectTo: '/v3/crm', pathMatch: 'full' },
      { path: 'crm/ticket/:ticketId', redirectTo: '/v3/crm/ticket/:ticketId', pathMatch: 'full' },
      { path: 'academy', redirectTo: '/v3/academy', pathMatch: 'full' },
      { path: 'academy/catalog', redirectTo: '/v3/academy/catalog', pathMatch: 'full' },
      { path: 'academy/course/:id/certificate', redirectTo: '/v3/academy/course/:id/certificate', pathMatch: 'full' },
      { path: 'academy/course/:id', redirectTo: '/v3/academy/course/:id', pathMatch: 'full' },
      { path: 'academy/studio', redirectTo: '/v3/academy/studio', pathMatch: 'full' },
      { path: 'academy/studio/course/:id', redirectTo: '/v3/academy/studio/course/:id', pathMatch: 'full' },
      { path: 'academy/analytics', redirectTo: '/v3/academy/analytics', pathMatch: 'full' },
      { path: 'staff-management', redirectTo: '/v3/staff-management', pathMatch: 'full' },
      { path: 'tree-builder', redirectTo: '/v3/tree-builder', pathMatch: 'full' },
      { path: 'kb-map-builder', redirectTo: '/v3/kb-map-builder', pathMatch: 'full' },
      { path: 'case-tag-builder', redirectTo: '/v3/case-tag-builder', pathMatch: 'full' },
      { path: 'prompt-map-builder', redirectTo: '/v3/prompt-map-builder', pathMatch: 'full' },
      { path: 'article-management', redirectTo: '/v3/article-management', pathMatch: 'full' },
      { path: 'article-management/edit/:id', redirectTo: '/v3/article-management/edit/:id', pathMatch: 'full' },
      { path: 'role-access-map', redirectTo: '/v3/role-access-map', pathMatch: 'full' },
      { path: 'settings', redirectTo: '/v3/settings', pathMatch: 'full' },
      { path: 'adherence-dashboard', redirectTo: '/v3/adherence-dashboard', pathMatch: 'full' },
      { path: 'qa-evaluation', redirectTo: '/v3/qa-evaluation', pathMatch: 'full' },
      { path: 'team-management', redirectTo: '/v3/team-management', pathMatch: 'full' },
      { path: 'channel-access-map', redirectTo: '/v3/channel-access-map', pathMatch: 'full' },
      { path: 'flowdesk', redirectTo: '/v3/flowdesk/board', pathMatch: 'full' },
      { path: 'flowdesk/board', redirectTo: '/v3/flowdesk/board', pathMatch: 'full' },
      { path: 'flowdesk/backlog', redirectTo: '/v3/flowdesk/backlog', pathMatch: 'full' },
      { path: 'flowdesk/sprints', redirectTo: '/v3/flowdesk/sprints', pathMatch: 'full' },
      { path: 'flowdesk/reports', redirectTo: '/v3/flowdesk/reports', pathMatch: 'full' },
      { path: 'flowdesk/escalations', redirectTo: '/v3/flowdesk/escalations', pathMatch: 'full' },
      { path: '**', redirectTo: '/v3/404', pathMatch: 'full' }
    ]
  },
  {
    path: 'v3',
    loadComponent: loadV3Shell,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', loadComponent: loadV3Home },
      { path: 'calendar', loadComponent: () => import('./components/calendar/calendar').then(m => m.CalendarComponent), canActivate: [RoleGuard], data: { feature: 'calendar' } },
      { path: 'magic-assistance', loadComponent: loadMagicAssistance, canActivate: [RoleGuard], data: { feature: 'magic_assistance' } },
      { path: 'knowledge-base', loadComponent: loadKnowledgeBase, canActivate: [RoleGuard], data: { feature: 'knowledge_base' } },
      { path: 'knowledge-hub', loadComponent: loadKnowledgeHub, canActivate: [RoleGuard], data: { feature: 'knowledge_base' } },
      { path: 'knowledge-hub/category/:categoryId', loadComponent: loadKnowledgeHubCategory, canActivate: [RoleGuard], data: { feature: 'knowledge_base' } },
      { path: 'knowledge-hub/article/:articleId', loadComponent: loadKnowledgeHubReader, canActivate: [RoleGuard], data: { feature: 'knowledge_base' } },
      { path: 'kb-analytics', loadComponent: loadKbAnalyticsDashboard, canActivate: [RoleGuard], data: { feature: 'knowledge_analytics' } },
      { path: 'collaboration', loadComponent: loadCollaborationHub, canActivate: [RoleGuard], data: { feature: 'collaboration' } },
      { path: 'chat-projects', loadComponent: loadChatProjects, canActivate: [RoleGuard], data: { feature: 'chat_projects' } },
      { path: 'live-chat', loadComponent: loadLiveChat, canActivate: [RoleGuard], data: { feature: 'live_chat' } },
      { path: 'process-assistant', loadComponent: loadProcessAssistant, canActivate: [RoleGuard], data: { feature: 'process_assistant' } },
      { path: 'crm', loadComponent: loadCrm, canActivate: [RoleGuard], data: { feature: 'flowdesk' } },
      { path: 'crm/ticket/:ticketId', loadComponent: loadCrm, canActivate: [RoleGuard], data: { feature: 'flowdesk' } },
      { path: 'academy', loadComponent: loadTrainingHome, canActivate: [RoleGuard], data: { feature: 'academy_home' } },
      { path: 'academy/catalog', loadComponent: loadTrainingCatalog, canActivate: [RoleGuard], data: { feature: 'academy_catalog' } },
      { path: 'academy/course/:id/certificate', loadComponent: loadTrainingCertificate, canActivate: [RoleGuard], data: { feature: 'academy_home' } },
      { path: 'academy/course/:id', loadComponent: loadTrainingCourseViewer, canActivate: [RoleGuard], data: { feature: 'academy_home' } },
      { path: 'academy/studio', loadComponent: loadTrainingStudio, canActivate: [RoleGuard], data: { feature: 'academy_studio' } },
      { path: 'academy/studio/course/:id', loadComponent: loadTrainingCourseEditor, canActivate: [RoleGuard], data: { feature: 'academy_studio' } },
      { path: 'academy/analytics', loadComponent: loadTrainingAnalytics, canActivate: [RoleGuard], data: { feature: 'academy_analytics' } },
      { path: 'staff-management', loadComponent: loadStaffManagement, canActivate: [RoleGuard], data: { roles: ['ADMIN'], feature: 'staff_management' } },
      { path: 'tree-builder', loadComponent: loadTreeBuilder, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'builders' } },
      { path: 'kb-map-builder', loadComponent: loadKbMapBuilder, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'builders' } },
      { path: 'article-validation-chain', loadComponent: loadArticleValidationChainBuilder, canActivate: [RoleGuard], data: { feature: 'kb_validation_chain' } },
      { path: 'case-tag-builder', loadComponent: loadCaseTagBuilder, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'builders' } },
      { path: 'prompt-map-builder', loadComponent: loadPromptMapBuilder, canActivate: [RoleGuard], data: { roles: ['ADMIN'], feature: 'prompt_map_builder' } },
      { path: 'article-management', loadComponent: loadArticleManagement, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'article_management' } },
      { path: 'article-management/edit/:id', loadComponent: loadArticleEditor, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'article_management' } },
      { path: 'article-validation', loadComponent: loadArticleValidation, canActivate: [RoleGuard], data: { feature: 'kb_article_validation' } },
      { path: 'role-access-map', loadComponent: loadRoleAccessMap, canActivate: [RoleGuard], data: { roles: ['ADMIN'], feature: 'role_access_map' } },
      { path: 'settings', loadComponent: loadUserSettings, canActivate: [RoleGuard], data: { feature: 'user_settings' } },
      { path: '404', loadComponent: loadNotFound },
      { path: 'article-not-found', loadComponent: loadArticleNotFound },
      { path: 'adherence-dashboard', loadComponent: loadAdherenceDashboard, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'TEAM_LEADER', 'QA', 'HEAD_CS', 'OPS'], feature: 'adherence' } },
      { path: 'qa-evaluation', loadComponent: loadQaEvaluation, canActivate: [RoleGuard], data: { roles: ['QA', 'ADMIN', 'HEAD_CS', 'OPS'], feature: 'qa_evaluation' } },
      { path: 'team-management', loadComponent: loadTeamManagement, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS', 'OPS'], feature: 'team_management' } },
      { path: 'channel-access-map', loadComponent: loadChannelAccessMap, canActivate: [RoleGuard], data: { roles: ['ADMIN'], feature: 'channel_access_map' } },
      { path: 'flowdesk', redirectTo: 'flowdesk/board', pathMatch: 'full' },
      { path: 'flowdesk/board', loadComponent: loadFlowdeskBoard, canActivate: [RoleGuard], data: { feature: 'flowdesk' } },
      { path: 'flowdesk/backlog', loadComponent: loadFlowdeskBacklog, canActivate: [RoleGuard], data: { feature: 'flowdesk' } },
      { path: 'flowdesk/sprints', loadComponent: loadFlowdeskSprints, canActivate: [RoleGuard], data: { feature: 'flowdesk' } },
      { path: 'flowdesk/reports', loadComponent: loadFlowdeskReports, canActivate: [RoleGuard], data: { feature: 'flowdesk' } },
      { path: 'flowdesk/escalations', loadComponent: loadFlowdeskEscalations, canActivate: [RoleGuard], data: { feature: 'escalation_desk' } },
      { path: '**', redirectTo: '404', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '404' }
];

