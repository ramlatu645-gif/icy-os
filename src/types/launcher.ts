/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ScreenRoute = 'setup' | 'lock' | 'password-unlock' | 'home' | 'settings' | 'help';

export type SetupStepId =
  | 'welcome'
  | 'ai-personalization'
  | 'ai-scope'
  | 'ai-permissions'
  | 'finalize-setup'
  | 'completed';

export type AIApplicationScope =
  | 'official-only'
  | 'third-party-only'
  | 'both';

export interface PersonalizedAIConfig {
  version: number;
  assistantName: string;
  enabled: boolean;
  applicationScope: AIApplicationScope;
  lockScreenChatEnabled: boolean;
  updatedAt: string;
}

export interface AICapabilityPermissions {
  version: number;
  chatAndAssistance: boolean;
  applicationContextAccess: boolean;
  applicationActions: boolean;
  requireConfirmationForSensitiveActions: boolean;
  authorizedContextAppIds: string[];
  authorizedActionAppIds: string[];
  updatedAt: string;
}

export type IcyPlatformConnectionStatus =
  | 'not-configured'
  | 'not-connected'
  | 'connecting'
  | 'connected'
  | 'authentication-failed'
  | 'insufficient-permissions'
  | 'service-unavailable'
  | 'awaiting-authorization'
  | 'authenticated'
  | 'session-expired'
  | 'offline';

export type IcyAccountConnectionStatus =
  | 'not-connected'
  | 'awaiting-authorization'
  | 'authenticated'
  | 'connected'
  | 'service-unavailable'
  | 'session-expired'
  | 'offline';

export interface IcyAccountUserIdentity {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  roles?: string[];
}

export interface IcyAccountSessionRecord {
  version: number;
  status: IcyAccountConnectionStatus;
  isAuthenticated: boolean;
  user: IcyAccountUserIdentity | null;
  grantedScopes: string[];
  sessionExpiresAt: string | null;
  lastVerifiedAt: string | null;
  errorDetail: string | null;
  hasBackendServiceConfigured: boolean;
  hasServiceKeyConfigured: boolean;
  serviceKeyHint: string | null;
}

export type OfficialAppImplementationStatus =
  | 'implemented'
  | 'preview'
  | 'stub'
  | 'planned';

export type OfficialAppCompatibilityStatus =
  | 'compatible'
  | 'incompatible'
  | 'requires-platform-bridge';

export type OfficialAppRuntimeType =
  | 'web-app'
  | 'desktop-binary'
  | 'mobile-native'
  | 'system-service';

export interface DelegatedAppToken {
  appId: string;
  tokenType: 'Bearer';
  delegatedToken: string;
  permissions: string[];
  expiresAt: string;
}

export interface IcyServiceStatusRecord {
  version: number;
  status: IcyPlatformConnectionStatus;
  hasKeyConfigured: boolean;
  keyHint: string | null;
  hasBackendBaseUrlConfigured: boolean;
  lastVerifiedAt: string | null;
  errorDetail: string | null;
}

export interface FirstRunSetupState {
  version: number;
  isCompleted: boolean;
  currentStep: SetupStepId;
  completedAt: string | null;
}

export type ThemeOption =
  | 'system'
  | 'light'
  | 'dark'
  | 'blue'
  | 'green'
  | 'purple'
  | 'slate'
  | 'amber'
  | 'rose';

export type ResolvedTheme =
  | 'light'
  | 'dark'
  | 'blue'
  | 'green'
  | 'purple'
  | 'slate'
  | 'amber'
  | 'rose';

export type TimeFormatOption = '12h' | '24h';

export interface LauncherPreferences {
  version: number;
  theme: ThemeOption;
  fontSizeScale: number; // e.g., 0.85 to 1.25 (default 1.0)
  displaySizeScale: number; // e.g., 0.9 to 1.15 (default 1.0)
  timeFormat: TimeFormatOption;
  wallpaper: string;
  showTaskbar: boolean;
  showSidebar: boolean;
  aiOperatorEnabled: boolean;
  pinnedAppIds: string[];
  themeColor?: string;
  localProfile: {
    displayName: string;
  };
}

export interface PasswordVerifierRecord {
  version: number;
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  saltHex: string;
  hashHex: string;
  updatedAt: string;
}

export interface SecurityState {
  isPasswordEnabled: boolean;
  isLocked: boolean;
  failedAttempts: number;
  lockoutUntil: number | null;
}

export type SupportedPlatform = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'web';

export type LaunchMethod =
  | 'android-intent'
  | 'ios-universal-link'
  | 'ios-url-scheme'
  | 'desktop-protocol'
  | 'native-binary'
  | 'external-web-url';

export type AppPublisherSource = 'icy-official' | 'third-party';

export type ApplicationAvailabilityStatus =
  | 'installed-launchable'
  | 'registered-unavailable'
  | 'incompatible-platform'
  | 'native-integration-unavailable'
  | 'missing-application-files'
  | 'invalid-launch-configuration';

export type LaunchOutcomeStatus =
  | 'launch-request-accepted'
  | 'external-url-opened'
  | 'native-launch-confirmed'
  | 'target-application-unavailable'
  | 'unsupported-platform'
  | 'invalid-launch-target'
  | 'missing-permission'
  | 'native-integration-not-installed'
  | 'launch-request-failed';

export interface LaunchResult {
  status: LaunchOutcomeStatus;
  appId: string;
  appName: string;
  initiated: boolean;
  confirmedByPlatform: boolean;
  userMessage: string;
  technicalReason?: string;
  timestamp: string;
}

export interface RegisteredApplication {
  id: string;
  name: string;
  description?: string;
  iconResource: string;
  version: string;
  publisher: string;
  source: AppPublisherSource;
  installed: boolean;
  available?: boolean;
  filesPresent?: boolean;
  supportedPlatforms: SupportedPlatform[];
  launchMethod: LaunchMethod;
  verifiedLaunchTarget: string;
  nativePackageId?: string;
  registeredProtocol?: string;
  officialAppLink?: string;
  signatureVerified: boolean;
  permissions: string[];
  grantedPermissions?: string[];
  capabilities: string[];
  implementationStatus?: OfficialAppImplementationStatus;
  compatibilityStatus?: OfficialAppCompatibilityStatus;
  runtimeType?: OfficialAppRuntimeType;
  installedAt?: string;
}

export interface EvaluatedApplicationRecord {
  record: RegisteredApplication;
  availabilityStatus: ApplicationAvailabilityStatus;
  isSelectableAndLaunchable: boolean;
  reason?: string;
}
