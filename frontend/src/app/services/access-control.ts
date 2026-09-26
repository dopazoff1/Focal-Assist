import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';

export interface AccessFeatureDefinition {
  key: string;
  label: string;
  description: string;
  route: string;
  x: number;
  y: number;
}

export interface AccessRoleProfile {
  id: number;
  name: string;
  description: string;
  system: boolean;
  active: boolean;
  x: number;
  y: number;
}

export interface AccessRoleLink {
  roleName: string;
  featureKey: string;
}

export interface AccessControlConfig {
  roles: AccessRoleProfile[];
  links: AccessRoleLink[];
}

const API_URL = '/api/access-control';
const ALWAYS_FEATURES = new Set(['command_center', 'user_settings']);
const LEGACY_HIDDEN_FEATURE_KEYS = new Set(['academy', 'academy_course', 'academy_certificate']);

const FEATURE_CATALOG: AccessFeatureDefinition[] = [
  { key: 'command_center', label: 'Command Center', description: 'Main home workspace.', route: '/v3/home', x: 760, y: 60 },
  { key: 'calendar', label: 'Calendar', description: 'Orbit Calendar workspace.', route: '/v3/calendar', x: 760, y: 160 },
  { key: 'magic_assistance', label: 'Magic Assistance', description: 'Decision-tree assistant.', route: '/v3/magic-assistance', x: 760, y: 260 },
  { key: 'knowledge_base', label: 'Knowledge Base', description: 'Read KB articles and maps.', route: '/v3/knowledge-base', x: 760, y: 360 },
  { key: 'knowledge_analytics', label: 'KB Analytics', description: 'Article readership time and access analytics.', route: '/v3/kb-analytics', x: 760, y: 460 },
  { key: 'article_management', label: 'Article Management', description: 'Create/edit KB content.', route: '/v3/article-management', x: 760, y: 560 },
  { key: 'kb_article_validation', label: 'Article Validation Queue', description: 'Review and publish article revisions.', route: '/v3/article-validation', x: 760, y: 660 },
  { key: 'kb_validation_chain', label: 'Validation Chain Builder', description: 'Configure the global article review sequence.', route: '/v3/article-validation-chain', x: 760, y: 760 },
  { key: 'collaboration', label: 'Collaboration Hub', description: 'Channels and direct messages.', route: '/v3/collaboration', x: 760, y: 660 },
  { key: 'chat_projects', label: 'Chat Projects', description: 'Project-based public chatbot and workflow management.', route: '/v3/chat-projects', x: 760, y: 760 },
  { key: 'live_chat', label: 'Live Chat', description: 'Realtime assigned customer chats.', route: '/v3/live-chat', x: 760, y: 860 },
  { key: 'process_assistant', label: 'Process Assistant', description: 'Prompt-mapped AI assistant.', route: '/v3/process-assistant', x: 760, y: 960 },
  { key: 'academy_home', label: 'Academy - My Trainings', description: 'User training home page.', route: '/v3/academy', x: 760, y: 1060 },
  { key: 'academy_catalog', label: 'Academy - Catalog', description: 'Training catalog browsing.', route: '/v3/academy/catalog', x: 760, y: 1160 },
  { key: 'academy_studio', label: 'Studio - Training Studio', description: 'Training creation, assignments, and course editing.', route: '/v3/academy/studio', x: 760, y: 1260 },
  { key: 'academy_analytics', label: 'Studio - Analytics', description: 'Training adherence and learning analytics.', route: '/v3/academy/analytics', x: 760, y: 1360 },
  { key: 'flowdesk', label: 'FlowDesk', description: 'Board, backlog, sprints, reports.', route: '/v3/flowdesk/board', x: 1140, y: 60 },
  { key: 'escalation_desk', label: 'Escalation Desk', description: 'L1/L2 escalation ticketing.', route: '/v3/flowdesk/escalations', x: 1140, y: 160 },
  { key: 'qa_evaluation', label: 'QA Evaluation', description: 'Case scoring and reviews.', route: '/v3/qa-evaluation', x: 1140, y: 260 },
  { key: 'adherence', label: 'Adherence Dashboard', description: 'Timeline and adherence insights.', route: '/v3/adherence-dashboard', x: 1140, y: 360 },
  { key: 'team_management', label: 'Team Management', description: 'Link agents to TL/QA.', route: '/v3/team-management', x: 1140, y: 460 },
  { key: 'channel_access_map', label: 'Channel Access Map', description: 'Control channel membership map.', route: '/v3/channel-access-map', x: 1140, y: 560 },
  { key: 'builders', label: 'Tree Builders', description: 'Tree/KB/Tag builders.', route: '/v3/tree-builder', x: 1140, y: 660 },
  { key: 'prompt_map_builder', label: 'Prompt Map Builder', description: 'Role-to-prompt access mapping.', route: '/v3/prompt-map-builder', x: 1140, y: 760 },
  { key: 'staff_management', label: 'Staff Management', description: 'Create/deactivate accounts.', route: '/v3/staff-management', x: 1140, y: 860 },
  { key: 'role_access_map', label: 'Role Access Map', description: 'Manage account types and feature access.', route: '/v3/role-access-map', x: 1520, y: 100 },
  { key: 'user_settings', label: 'User Settings', description: 'Profile and personal settings.', route: '/v3/settings', x: 1520, y: 220 }
];

const SYSTEM_ROLE_ORDER = [
  'ADMIN',
  'HEAD_CS',
  'OPS',
  'TEAM_LEADER',
  'QA',
  'AGENT'
];

const DEFAULT_ROLE_FEATURES: Record<string, string[]> = {
  ADMIN: FEATURE_CATALOG.map(feature => feature.key),
  HEAD_CS: [
    'command_center', 'calendar', 'magic_assistance', 'knowledge_base', 'knowledge_analytics', 'article_management', 'collaboration', 'chat_projects', 'live_chat',
    'process_assistant', 'academy_home', 'academy_catalog', 'academy_studio', 'academy_analytics',
    'flowdesk', 'escalation_desk', 'qa_evaluation', 'adherence', 'team_management',
    'builders', 'prompt_map_builder', 'user_settings'
  ],
  OPS: [
    'command_center', 'calendar', 'magic_assistance', 'knowledge_base', 'knowledge_analytics', 'article_management', 'collaboration', 'chat_projects', 'live_chat',
    'process_assistant', 'academy_home', 'academy_catalog', 'academy_studio', 'academy_analytics',
    'flowdesk', 'escalation_desk', 'qa_evaluation', 'adherence', 'team_management',
    'user_settings'
  ],
  TEAM_LEADER: [
    'command_center', 'calendar', 'magic_assistance', 'knowledge_base', 'knowledge_analytics', 'collaboration', 'live_chat', 'process_assistant',
    'academy_home', 'academy_catalog', 'academy_studio', 'academy_analytics',
    'flowdesk', 'escalation_desk', 'adherence', 'user_settings'
  ],
  QA: [
    'command_center', 'calendar', 'magic_assistance', 'knowledge_base', 'knowledge_analytics', 'collaboration', 'live_chat', 'process_assistant',
    'academy_home', 'academy_catalog', 'academy_studio', 'academy_analytics',
    'flowdesk', 'escalation_desk', 'qa_evaluation', 'adherence', 'user_settings'
  ],
  AGENT: [
    'command_center', 'calendar', 'magic_assistance', 'knowledge_base', 'collaboration', 'live_chat', 'process_assistant',
    'academy_home', 'academy_catalog',
    'flowdesk', 'escalation_desk', 'user_settings'
  ]
};

function normalizeRoleName(raw: string): string {
  const role = (raw || '').toString().trim().toUpperCase().replace(/^ROLE_/, '');
  if (role === 'HEAD_OF_CS') return 'HEAD_CS';
  if (role === 'TL') return 'TEAM_LEADER';
  if (role === 'QUALITY') return 'QA';
  if (role === '1') return 'ADMIN';
  if (role === '2') return 'AGENT';
  if (role === '3') return 'TEAM_LEADER';
  if (role === '4') return 'QA';
  if (role === '5') return 'HEAD_CS';
  if (role === '6') return 'OPS';
  return role;
}

@Injectable({ providedIn: 'root' })
export class AccessControlService {
  private readonly configSubject = new BehaviorSubject<AccessControlConfig>(this.defaultConfig());
  readonly config$ = this.configSubject.asObservable();
  private loaded = false;
  private loading$?: Observable<AccessControlConfig>;

  constructor(private http: HttpClient) {}

  ensureLoaded(force = false): Observable<AccessControlConfig> {
    if (this.loaded && !force) {
      return of(this.cloneConfig(this.configSubject.value));
    }
    if (this.loading$ && !force) {
      return this.loading$;
    }
    const request$ = this.http.get<AccessControlConfig>(`${API_URL}/config`).pipe(
      map(config => this.normalizeConfig(config)),
      tap(config => {
        this.loaded = true;
        this.configSubject.next(config);
      }),
      catchError(() => {
        const fallback = this.defaultConfig();
        this.loaded = true;
        this.configSubject.next(fallback);
        return of(fallback);
      }),
      map(config => this.cloneConfig(config)),
      finalize(() => {
        this.loading$ = undefined;
      }),
      shareReplay(1)
    );
    this.loading$ = request$;
    return request$;
  }

  getFeatures(): AccessFeatureDefinition[] {
    return FEATURE_CATALOG.map(feature => ({ ...feature }));
  }

  getConfigSnapshot(): AccessControlConfig {
    return this.cloneConfig(this.configSubject.value);
  }

  saveConfig(config: AccessControlConfig): Observable<AccessControlConfig> {
    const payload = this.normalizeConfig(config);
    return this.http.put<AccessControlConfig>(`${API_URL}/config`, payload).pipe(
      map(res => this.normalizeConfig(res)),
      tap(res => {
        this.loaded = true;
        this.configSubject.next(res);
      }),
      map(res => this.cloneConfig(res))
    );
  }

  createRole(name: string, description = ''): Observable<AccessRoleProfile> {
    const roleName = normalizeRoleName(name);
    if (!roleName) {
      throw new Error('Role name is required.');
    }
    return this.http.post<AccessRoleProfile>(`${API_URL}/roles`, { name: roleName, description: description || '' }).pipe(
      map(role => this.normalizeRole(role)),
      tap(role => {
        const config = this.configSubject.value;
        const existing = config.roles.filter(item => item.name !== role.name);
        const next = this.normalizeConfig({
          roles: [...existing, role],
          links: config.links
        });
        this.loaded = true;
        this.configSubject.next(next);
      })
    );
  }

  deleteCustomRole(roleName: string): Observable<void> {
    const target = normalizeRoleName(roleName);
    if (!target) return of(void 0);
    return this.http.delete<void>(`${API_URL}/roles/${encodeURIComponent(target)}`).pipe(
      tap(() => {
        const config = this.configSubject.value;
        const next = this.normalizeConfig({
          roles: config.roles.filter(item => item.name !== target),
          links: config.links.filter(link => link.roleName !== target)
        });
        this.loaded = true;
        this.configSubject.next(next);
      })
    );
  }

  listAssignableRoleNames(): string[] {
    const config = this.configSubject.value;
    return config.roles
      .filter(role => role.active)
      .map(role => role.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  hasFeatureAccess(rawRole: string, featureKey: string): boolean {
    const role = normalizeRoleName(rawRole);
    const key = (featureKey || '').toString().trim();
    if (!role || !key) return false;
    const config = this.configSubject.value;
    const roleProfile = config.roles.find(item => item.name === role);
    if (!roleProfile || roleProfile.active === false) {
      return false;
    }
    const hasExplicitRoleLinks = config.links.some(link => link.roleName === role);
    // Safety fallback: keep core navigation for roles that have no links at all yet.
    if (ALWAYS_FEATURES.has(key) && !hasExplicitRoleLinks) {
      return true;
    }
    if (config.links.some(link => link.roleName === role && link.featureKey === key)) {
      return true;
    }
    if (key === 'knowledge_analytics') {
      return config.links.some(link => link.roleName === role && link.featureKey === 'knowledge_base');
    }
    // Backward compatibility: old academy keys still grant the four independent pages.
    if (key.startsWith('academy_')) {
      if (config.links.some(link => link.roleName === role && link.featureKey === 'academy')) {
        return true;
      }
      if (key === 'academy_home') {
        return config.links.some(link => link.roleName === role && (
          link.featureKey === 'academy_course' || link.featureKey === 'academy_certificate'
        ));
      }
    }
    return false;
  }

  isKnownRole(rawRole: string): boolean {
    const role = normalizeRoleName(rawRole);
    if (!role) return false;
    return this.configSubject.value.roles.some(item => item.name === role);
  }

  private normalizeConfig(config: AccessControlConfig): AccessControlConfig {
    const roles = (config?.roles || [])
      .map(role => this.normalizeRole(role))
      .filter(role => !!role.name);
    const roleNames = new Set(roles.map(role => role.name));
    const featureKeys = new Set([
      ...FEATURE_CATALOG.map(feature => feature.key),
      ...LEGACY_HIDDEN_FEATURE_KEYS
    ]);
    const links = this.uniqueLinks((config?.links || [])
      .map(link => ({
        roleName: normalizeRoleName(link.roleName),
        featureKey: (link.featureKey || '').toString().trim()
      }))
      .filter(link => !!link.roleName && featureKeys.has(link.featureKey) && roleNames.has(link.roleName)));

    return this.cloneConfig({ roles, links });
  }

  private normalizeRole(role: Partial<AccessRoleProfile>): AccessRoleProfile {
    return {
      id: Number(role.id || 0),
      name: normalizeRoleName(role.name || ''),
      description: (role.description || '').toString().trim(),
      system: !!role.system,
      active: role.active !== false,
      x: Number(role.x || 120),
      y: Number(role.y || 120)
    };
  }

  private defaultConfig(): AccessControlConfig {
    const roles: AccessRoleProfile[] = SYSTEM_ROLE_ORDER.map((name, index) => ({
      id: index + 1,
      name,
      description: `${name} system role`,
      system: true,
      active: true,
      x: 100,
      y: 80 + index * 120
    }));

    const links: AccessRoleLink[] = [];
    for (const roleName of Object.keys(DEFAULT_ROLE_FEATURES)) {
      for (const featureKey of DEFAULT_ROLE_FEATURES[roleName]) {
        links.push({ roleName, featureKey });
      }
    }
    return {
      roles,
      links: this.uniqueLinks(links)
    };
  }

  private uniqueLinks(links: AccessRoleLink[]): AccessRoleLink[] {
    const seen = new Set<string>();
    const out: AccessRoleLink[] = [];
    for (const link of links) {
      const roleName = normalizeRoleName(link.roleName);
      const featureKey = (link.featureKey || '').toString().trim();
      if (!roleName || !featureKey) continue;
      const key = `${roleName}:${featureKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ roleName, featureKey });
    }
    return out;
  }

  private cloneConfig(config: AccessControlConfig): AccessControlConfig {
    return {
      roles: (config.roles || []).map(role => ({ ...role })),
      links: (config.links || []).map(link => ({ ...link }))
    };
  }
}

