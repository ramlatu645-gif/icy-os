/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AICapabilityPermissions,
  FirstRunSetupState,
  IcyAccountSessionRecord,
  IcyServiceStatusRecord,
  LauncherPreferences,
  PersonalizedAIConfig,
  RegisteredApplication,
  ScreenRoute,
  SetupStepId,
} from './types/launcher';
import {
  loadPreferences,
  savePreferences,
  sanitizePreferences,
} from './storage/preferencesStorage';
import {
  loadSetupState,
  markSetupCompleted,
  updateSetupStep,
} from './storage/setupStateStorage';
import {
  loadAIConfig,
  saveAIConfig,
  validateAssistantName,
} from './storage/aiConfigStorage';
import {
  loadAIPermissions,
  saveAIPermissions,
} from './storage/aiPermissionStorage';
import { icyPlatformClient } from './services/icyPlatformBoundary';
import { icyAccountClient } from './services/icyAccountClient';
import { applyThemeAndScalesToDocument } from './theme/themeManager';
import { launcherSecurityService } from './security/passwordVerifier';
import { applicationRegistry } from './registry/applicationRegistry';
import {
  resolveSafeRouteTransition,
  resolveStartupRoute,
} from './routing/screenRouter';
import { SetupFlowScreen } from './components/screens/SetupFlowScreen';
import { LockScreen } from './components/screens/LockScreen';
import { PasswordUnlockScreen } from './components/screens/PasswordUnlockScreen';
import { HomeScreen } from './components/screens/HomeScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { HelpScreen } from './components/screens/HelpScreen';

export default function App() {
  // 1. Load saved local launcher preferences
  const [preferences, setPreferences] = useState<LauncherPreferences>(() =>
    loadPreferences()
  );

  // 2. Load first-run setup state
  const [setupState, setSetupState] = useState<FirstRunSetupState>(() =>
    loadSetupState()
  );

  // 3. Load saved launcher password security state
  const [hasConfiguredPassword, setHasConfiguredPassword] = useState<boolean>(() =>
    launcherSecurityService.hasConfiguredPasswordSync()
  );

  const [isLocked, setIsLocked] = useState<boolean>(() =>
    launcherSecurityService.hasConfiguredPasswordSync()
  );

  // 4. Load separated state domains (Personalized AI, AI Permissions, ICY Service status)
  const [aiConfig, setAiConfig] = useState<PersonalizedAIConfig>(() =>
    loadAIConfig()
  );

  const [aiPermissions, setAiPermissions] = useState<AICapabilityPermissions>(() =>
    loadAIPermissions()
  );

  const [serviceStatus, setServiceStatus] = useState<IcyServiceStatusRecord>(() =>
    icyPlatformClient.getCachedStatus()
  );

  const [accountSession, setAccountSession] = useState<IcyAccountSessionRecord>(() =>
    icyAccountClient.getCachedSession()
  );

  const [officialApps, setOfficialApps] = useState<RegisteredApplication[]>([]);

  // 5. Determine startup route based on setup completion and password protection
  const [currentRoute, setCurrentRoute] = useState<ScreenRoute>(() => {
    const initialSetup = loadSetupState();
    const hasPassword = launcherSecurityService.hasConfiguredPasswordSync();
    return resolveStartupRoute({
      isSetupCompleted: initialSetup.isCompleted,
      hasConfiguredPassword: hasPassword,
    });
  });

  // 6. Load installed application registry
  const [installedApps, setInstalledApps] = useState<RegisteredApplication[]>(() =>
    applicationRegistry.getInstalledApplications()
  );

  // Synchronize registry across storage updates
  useEffect(() => {
    const handleStorage = () => {
      setInstalledApps(applicationRegistry.getInstalledApplications());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('icy-registry-changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('icy-registry-changed', handleStorage);
    };
  }, []);

  // Refresh status and load registry from server on startup
  useEffect(() => {
    void icyPlatformClient.refreshStatus().then((status) => {
      setServiceStatus(status);
    });

    void icyAccountClient.getSession().then((session) => {
      setAccountSession(session);
    });

    void icyAccountClient.loadOfficialAppRegistry().then((apps) => {
      setOfficialApps(apps);
    });
  }, []);

  // Listen for OAuth postMessage callbacks from the authorization popup
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'ICY_AUTH_CALLBACK') {
        const { code, state } = event.data;
        if (code && state) {
          const res = await icyAccountClient.completeAuthorization(code, state);
          if (res.success) {
            setAccountSession(res.session);
          }
        }
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  // Apply theme, font scale, and display scale immediately
  useEffect(() => {
    applyThemeAndScalesToDocument(
      preferences.theme,
      preferences.fontSizeScale,
      preferences.displaySizeScale,
      preferences.themeColor
    );

    if (
      preferences.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia
    ) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        applyThemeAndScalesToDocument(
          'system',
          preferences.fontSizeScale,
          preferences.displaySizeScale,
          preferences.themeColor
        );
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [preferences.theme, preferences.fontSizeScale, preferences.displaySizeScale, preferences.themeColor]);

  const navigateTo = useCallback(
    (
      target: ScreenRoute,
      overridePasswordConfigured?: boolean,
      overrideLocked?: boolean,
      overrideSetupCompleted?: boolean
    ) => {
      const effectiveHasPassword =
        overridePasswordConfigured !== undefined
          ? overridePasswordConfigured
          : hasConfiguredPassword;
      const effectiveLocked =
        overrideLocked !== undefined ? overrideLocked : isLocked;
      const effectiveSetupCompleted =
        overrideSetupCompleted !== undefined
          ? overrideSetupCompleted
          : setupState.isCompleted;

      const nextRoute = resolveSafeRouteTransition(
        target,
        effectiveHasPassword,
        effectiveLocked,
        effectiveSetupCompleted
      );
      setCurrentRoute(nextRoute);
    },
    [hasConfiguredPassword, isLocked, setupState.isCompleted]
  );

  const handleUpdatePreferences = useCallback(
    (updater: (prev: LauncherPreferences) => LauncherPreferences) => {
      setPreferences((prev) => {
        const updated = sanitizePreferences(updater(prev));
        savePreferences(updated);
        return updated;
      });
    },
    []
  );

  const handleUpdateAIConfig = useCallback(
    (updater: (prev: PersonalizedAIConfig) => PersonalizedAIConfig) => {
      setAiConfig((prev) => {
        const updated = saveAIConfig(updater(prev));
        return updated;
      });
    },
    []
  );

  const handleUpdateAIPermissions = useCallback(
    (updater: (prev: AICapabilityPermissions) => AICapabilityPermissions) => {
      setAiPermissions((prev) => {
        const updated = saveAIPermissions(updater(prev));
        return updated;
      });
    },
    []
  );

  const handleChangeSetupStep = useCallback((step: SetupStepId) => {
    const updated = updateSetupStep(step);
    setSetupState(updated);
  }, []);

  const handleSubmitPlatformApiKey = useCallback(async (apiKey: string) => {
    const res = await icyPlatformClient.submitApplicationApiKey(apiKey);
    setServiceStatus(res.record);
    return res;
  }, []);

  const handleVerifyPlatformConnection = useCallback(async () => {
    const record = await icyPlatformClient.verifyConnection();
    setServiceStatus(record);
    return record;
  }, []);

  const handleDisconnectPlatformKey = useCallback(async () => {
    const record = await icyPlatformClient.disconnectKey();
    setServiceStatus(record);
    return record;
  }, []);

  /**
   * Performs the launcher initialization sequence:
   * 1. Validates user-entered assistant name.
   * 2. Saves assistant name, application scope, and lock-screen chat preference.
   * 3. Saves explicitly granted AI capability permissions.
   * 4. Applies selected launcher theme and display preferences.
   * 5. Initializes local application registry.
   * 6. Verifies cloud connection through a real request (without blocking local completion if offline).
   */
  const handleExecuteSetUpLauncher = useCallback(async () => {
    const nameCheck = validateAssistantName(aiConfig.assistantName);
    if (!nameCheck.valid) {
      return {
        localInitialized: false,
        serviceStatus,
      };
    }

    // Save AI config & permissions
    const savedAI = saveAIConfig({
      ...aiConfig,
      assistantName: nameCheck.normalized,
    });
    setAiConfig(savedAI);

    const savedPerms = saveAIPermissions(aiPermissions);
    setAiPermissions(savedPerms);

    // Apply theme and display preferences
    savePreferences(preferences);
    applyThemeAndScalesToDocument(
      preferences.theme,
      preferences.fontSizeScale,
      preferences.displaySizeScale,
      preferences.themeColor
    );

    // Initialize local application registry
    const apps = applicationRegistry.getInstalledApplications();
    setInstalledApps(apps);

    // Verify optional cloud connections via real requests (does not fail local setup if offline)
    const latestServiceStatus = await icyPlatformClient.refreshStatus();
    setServiceStatus(latestServiceStatus);

    return {
      localInitialized: true,
      serviceStatus: latestServiceStatus,
    };
  }, [aiConfig, aiPermissions, preferences, serviceStatus]);

  const handleEnterLauncherAfterSetup = useCallback(() => {
    const completed = markSetupCompleted();
    setSetupState(completed);
    const nextRoute = hasConfiguredPassword && isLocked ? 'lock' : 'home';
    setCurrentRoute(nextRoute);
  }, [hasConfiguredPassword, isLocked]);

  const handleRequestUnlockScreen = useCallback(() => {
    if (!hasConfiguredPassword) {
      setIsLocked(false);
      launcherSecurityService.setLocked(false);
      setCurrentRoute('home');
      return;
    }
    navigateTo('password-unlock', true, true, true);
  }, [hasConfiguredPassword, navigateTo]);

  const handleVerifyPassword = useCallback(async (password: string): Promise<boolean> => {
    return launcherSecurityService.verifyPassword(password);
  }, []);

  const handleUnlocked = useCallback(() => {
    setIsLocked(false);
    launcherSecurityService.setLocked(false);
    navigateTo('home', hasConfiguredPassword, false, true);
  }, [hasConfiguredPassword, navigateTo]);

  const handleCreatePassword = useCallback(async (newPassword: string) => {
    await launcherSecurityService.setNewPassword(newPassword);
    setHasConfiguredPassword(true);
    setIsLocked(false);
  }, []);

  const handleChangePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      return launcherSecurityService.changePassword(currentPassword, newPassword);
    },
    []
  );

  const handleDisablePassword = useCallback(async (currentPassword: string) => {
    const result = await launcherSecurityService.disablePasswordProtection(
      currentPassword
    );
    if (result.success) {
      setHasConfiguredPassword(false);
      setIsLocked(false);
    }
    return result;
  }, []);

  const handleLockLauncherImmediately = useCallback(() => {
    if (!hasConfiguredPassword) return;
    setIsLocked(true);
    launcherSecurityService.setLocked(true);
    setCurrentRoute('lock');
  }, [hasConfiguredPassword]);

  const handleUninstallApp = useCallback((appId: string) => {
    applicationRegistry.unregisterApplication(appId);
    setInstalledApps(applicationRegistry.getInstalledApplications());
  }, []);

  // ICY Account Handlers
  const handleStartAccountAuth = useCallback(async () => {
    const res = await icyAccountClient.startAccountAuthorization();
    if (res.success && res.authUrl) {
      window.open(res.authUrl, 'ICY_AUTH', 'width=500,height=650');
    }
    return res;
  }, []);

  const handleSignOutAccount = useCallback(async () => {
    const session = await icyAccountClient.signOut();
    setAccountSession(session);
    return session;
  }, []);

  const handleVerifyAccountSession = useCallback(async () => {
    const session = await icyAccountClient.verifyConnection();
    setAccountSession(session);
    return session;
  }, []);

  const handleRequestDelegatedToken = useCallback(async (appId: string) => {
    return icyAccountClient.requestDelegatedAppToken(appId);
  }, []);

  // Native Android hardware/gesture Back-button and Escape navigation handling
  useEffect(() => {
    const handleNativeBackNavigation = (event?: Event) => {
      if (currentRoute === 'settings') {
        event?.preventDefault?.();
        navigateTo('home', hasConfiguredPassword, false, true);
      } else if (currentRoute === 'password-unlock' && hasConfiguredPassword) {
        event?.preventDefault?.();
        navigateTo('lock', true, true, true);
      }
    };

    window.addEventListener('iclauncher:hardware-back', handleNativeBackNavigation);
    return () => {
      window.removeEventListener('iclauncher:hardware-back', handleNativeBackNavigation);
    };
  }, [currentRoute, hasConfiguredPassword, navigateTo]);

  // First-run setup route
  if (currentRoute === 'setup' && !setupState.isCompleted) {
    return (
      <SetupFlowScreen
        currentStep={setupState.currentStep}
        displaySizeScale={preferences.displaySizeScale}
        wallpaper={preferences.wallpaper}
        aiConfig={aiConfig}
        aiPermissions={aiPermissions}
        serviceStatus={serviceStatus}
        onChangeStep={handleChangeSetupStep}
        onUpdateAIConfig={handleUpdateAIConfig}
        onUpdateAIPermissions={handleUpdateAIPermissions}
        onExecuteSetUpLauncher={handleExecuteSetUpLauncher}
        onEnterLauncher={handleEnterLauncherAfterSetup}
      />
    );
  }

  // Lock screen route
  if (currentRoute === 'lock' && hasConfiguredPassword) {
    return (
      <LockScreen
        timeFormat={preferences.timeFormat}
        displaySizeScale={preferences.displaySizeScale}
        wallpaper={preferences.wallpaper}
        aiConfig={aiConfig}
        aiPermissions={aiPermissions}
        onRequestUnlock={handleRequestUnlockScreen}
      />
    );
  }

  // Password unlock screen route
  if (currentRoute === 'password-unlock' && hasConfiguredPassword) {
    return (
      <PasswordUnlockScreen
        displaySizeScale={preferences.displaySizeScale}
        wallpaper={preferences.wallpaper}
        onVerifyPassword={handleVerifyPassword}
        onUnlocked={handleUnlocked}
        onBackToLockScreen={() => navigateTo('lock', true, true, true)}
      />
    );
  }

  // Settings route
  if (currentRoute === 'settings') {
    return (
      <SettingsScreen
        preferences={preferences}
        hasConfiguredPassword={hasConfiguredPassword}
        aiConfig={aiConfig}
        aiPermissions={aiPermissions}
        serviceStatus={serviceStatus}
        accountSession={accountSession}
        officialApps={officialApps}
        installedApps={installedApps}
        onUpdatePreferences={handleUpdatePreferences}
        onCreatePassword={handleCreatePassword}
        onChangePassword={handleChangePassword}
        onDisablePassword={handleDisablePassword}
        onLockLauncherImmediately={handleLockLauncherImmediately}
        onUpdateAIConfig={handleUpdateAIConfig}
        onUpdateAIPermissions={handleUpdateAIPermissions}
        onSubmitPlatformApiKey={handleSubmitPlatformApiKey}
        onVerifyPlatformConnection={handleVerifyPlatformConnection}
        onDisconnectPlatformKey={handleDisconnectPlatformKey}
        onStartAccountAuth={handleStartAccountAuth}
        onSignOutAccount={handleSignOutAccount}
        onVerifyAccountSession={handleVerifyAccountSession}
        onRequestDelegatedToken={handleRequestDelegatedToken}
        onUninstallApp={handleUninstallApp}
        onBackToHome={() => navigateTo('home', hasConfiguredPassword, false, true)}
      />
    );
  }

  // Help route
  if (currentRoute === 'help') {
    return (
      <HelpScreen
        preferences={preferences}
        onBackToHome={() => navigateTo('home', hasConfiguredPassword, false, true)}
      />
    );
  }

  // Main Launcher Home Screen
  return (
    <HomeScreen
      installedApps={installedApps}
      preferences={preferences}
      aiConfig={aiConfig}
      onUpdatePreferences={handleUpdatePreferences}
      onOpenSettings={() =>
        navigateTo('settings', hasConfiguredPassword, false, true)
      }
    />
  );
}
