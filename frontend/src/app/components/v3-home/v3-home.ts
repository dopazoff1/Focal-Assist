import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideActivity,
  LucideArrowRight,
  LucideBookOpen,
  LucideBot,
  LucideCalendarDays,
  LucideChartNoAxesCombined,
  LucideClipboardCheck,
  LucideClock3,
  LucideFileText,
  LucideGauge,
  LucideGraduationCap,
  LucideInbox,
  LucideKanban,
  LucideKanbanSquare,
  LucideKeyRound,
  LucideMap,
  LucideMessageCircle,
  LucideMessagesSquare,
  LucideSettings,
  LucideShieldCheck,
  LucideSparkles,
  LucideTags,
  LucideUserRoundCog,
  LucideUsers,
  LucideWandSparkles,
  LucideWorkflow
} from '@lucide/angular';
import { I18nPipe } from '../../pipes/i18n.pipe';
import { AuthService } from '../../services/auth';
import { AccessControlService } from '../../services/access-control';

@Component({
  selector: 'app-v3-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    I18nPipe,
    LucideActivity,
    LucideArrowRight,
    LucideBookOpen,
    LucideBot,
    LucideCalendarDays,
    LucideChartNoAxesCombined,
    LucideClipboardCheck,
    LucideClock3,
    LucideFileText,
    LucideGauge,
    LucideGraduationCap,
    LucideInbox,
    LucideKanban,
    LucideKanbanSquare,
    LucideKeyRound,
    LucideMap,
    LucideMessageCircle,
    LucideMessagesSquare,
    LucideSettings,
    LucideShieldCheck,
    LucideSparkles,
    LucideTags,
    LucideUserRoundCog,
    LucideUsers,
    LucideWandSparkles,
    LucideWorkflow
  ],
  templateUrl: './v3-home.html',
  styleUrls: ['./v3-home.css']
})
export class V3Home {
  constructor(
    public auth: AuthService,
    private accessControl: AccessControlService
  ) {}

  get roleLabel(): string {
    return this.auth.getNormalizedRole() || 'USER';
  }

  get canUseBuilders(): boolean {
    return this.hasFeatureAccess('builders');
  }

  get canManageArticles(): boolean {
    return this.hasFeatureAccess('article_management');
  }

  get canManageTeams(): boolean {
    return this.hasFeatureAccess('team_management');
  }

  get canUseQaEvaluation(): boolean {
    return this.hasFeatureAccess('qa_evaluation');
  }

  get canViewAdherence(): boolean {
    return this.hasFeatureAccess('adherence');
  }

  get canManageStaff(): boolean {
    return this.hasFeatureAccess('staff_management');
  }

  get canUseFlowDesk(): boolean {
    return this.hasFeatureAccess('flowdesk');
  }

  get canUseProcessAssistant(): boolean {
    return this.hasFeatureAccess('process_assistant');
  }

  get canUseCollaboration(): boolean {
    return this.hasFeatureAccess('collaboration');
  }

  get canManageChatProjects(): boolean {
    return this.hasFeatureAccess('chat_projects');
  }

  get canUseLiveChat(): boolean {
    return this.hasFeatureAccess('live_chat');
  }

  get canUseCalendar(): boolean {
    return this.hasFeatureAccess('calendar');
  }

  get canUseCrm(): boolean {
    return this.hasFeatureAccess('flowdesk');
  }

  get canUseMagicAssistance(): boolean {
    return this.hasFeatureAccess('magic_assistance');
  }

  get canUseKnowledgeBase(): boolean {
    return this.hasFeatureAccess('knowledge_base');
  }

  get canUseKnowledgeAnalytics(): boolean {
    return this.hasFeatureAccess('knowledge_analytics');
  }

  get canUseAcademy(): boolean {
    return this.hasFeatureAccess('academy_home')
      || this.hasFeatureAccess('academy_catalog')
      || this.hasFeatureAccess('academy_studio')
      || this.hasFeatureAccess('academy_analytics');
  }

  get canManagePromptMap(): boolean {
    return this.hasFeatureAccess('prompt_map_builder');
  }

  get canManageRoleAccessMap(): boolean {
    return this.hasFeatureAccess('role_access_map');
  }

  get canUseUserSettings(): boolean {
    return this.hasFeatureAccess('user_settings');
  }

  get showCustomerOperations(): boolean {
    return this.canUseCrm
      || this.canUseCollaboration
      || this.canUseLiveChat
      || this.canManageChatProjects
      || this.canUseCalendar
      || this.canUseFlowDesk;
  }

  get showAssistanceAndKnowledge(): boolean {
    return this.canUseMagicAssistance
      || this.canUseKnowledgeBase
      || this.canUseKnowledgeAnalytics
      || this.canUseProcessAssistant
      || this.canUseAcademy;
  }

  get showQualityAndWorkforce(): boolean {
    return this.canManageArticles
      || this.canManageTeams
      || this.canUseQaEvaluation
      || this.canViewAdherence;
  }

  get showBuildAndAdministration(): boolean {
    return this.canUseBuilders
      || this.canManagePromptMap
      || this.canManageStaff
      || this.canManageRoleAccessMap
      || this.canUseUserSettings;
  }

  get showQuickActions(): boolean {
    return this.canUseCrm
      || this.canUseCalendar
      || this.canUseKnowledgeBase
      || this.canUseMagicAssistance
      || this.canUseCollaboration
      || this.canUseProcessAssistant;
  }

  private hasFeatureAccess(featureKey: string): boolean {
    const role = this.auth.getNormalizedRole();
    return this.accessControl.hasFeatureAccess(role, featureKey);
  }
}
