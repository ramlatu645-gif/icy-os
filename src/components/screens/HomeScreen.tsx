/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Settings, 
  X, 
  Camera, 
  FileText, 
  MessageCircle, 
  LayoutGrid,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Layers,
  PanelsTopLeft,
  SlidersHorizontal,
  Plus,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  LaunchResult,
  RegisteredApplication,
  LauncherPreferences,
  PersonalizedAIConfig
} from '../../types/launcher';
import { useLiveClock } from '../../hooks/useLiveClock';
import { useDeviceHardwareStatus } from '../../hooks/useDeviceHardwareStatus';
import { filterInstalledApplications } from '../../search/appSearch';
import { platformAppLauncher } from '../../platform/platformLauncher';
import { applicationRegistry } from '../../registry/applicationRegistry';
import { WallpaperBackground } from '../common/WallpaperBackground';
import { IcosAppShell, AppWorkspace } from '../os/AppWindow';
import { useAIOperatorVoice } from '../../hooks/useAIOperatorVoice';
import { CodeRunnerModal } from '../os/CodeRunnerModal';
import { Spatial3DModelerModal } from '../os/Spatial3DModelerModal';
import { DrawingCanvasModal } from '../os/DrawingCanvasModal';
import { VectorDesignModal } from '../os/VectorDesignModal';
import { DeviceSetupModal } from '../os/DeviceSetupModal';
import { AppActionMenu } from '../os/AppActionMenu';
import { AppInfoModal } from '../os/AppInfoModal';
import { DesktopContextMenu } from '../os/DesktopContextMenu';
import { NewWebsiteShortcutModal } from '../os/NewWebsiteShortcutModal';
import { useDeviceFormFactor } from '../../hooks/useDeviceFormFactor';

interface HomeScreenProps {
  installedApps: readonly RegisteredApplication[];
  preferences: LauncherPreferences;
  aiConfig: PersonalizedAIConfig;
  onOpenSettings: () => void;
  onUpdatePreferences?: (updater: (prev: LauncherPreferences) => LauncherPreferences) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  installedApps: initialApps,
  preferences,
  aiConfig,
  onOpenSettings,
  onUpdatePreferences,
}) => {
  const clock = useLiveClock(preferences.timeFormat);
  const hardwareStatus = useDeviceHardwareStatus();
  const formFactor = useDeviceFormFactor();
  const desktopRef = useRef<HTMLDivElement>(null);
  
  const [installedAppsList, setInstalledAppsList] = useState<RegisteredApplication[]>([...initialApps]);
  const [removedAppIds, setRemovedAppIds] = useState<string[]>([]);
  const [sidebarAppIds, setSidebarAppIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [lastLaunchResult, setLastLaunchResult] = useState<LaunchResult | null>(null);
  const [failedIconIds, setFailedIconIds] = useState<Record<string, boolean>>({});
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isShellHidden, setIsShellHidden] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // App Action Menu & Info Modal State
  const [selectedActionApp, setSelectedActionApp] = useState<RegisteredApplication | null>(null);
  const [selectedInfoApp, setSelectedInfoApp] = useState<RegisteredApplication | null>(null);

  
  // Creative Modules State
  const [isDeviceSetupOpen, setIsDeviceSetupOpen] = useState(false);
  const [codeStudioState, setCodeStudioState] = useState<{ isOpen: boolean; code?: string; title?: string }>({ isOpen: false });
  const [spatial3DState, setSpatial3DState] = useState<{ isOpen: boolean; shape?: 'torus' | 'crystal' | 'sphere' | 'cube' | 'wave'; title?: string }>({ isOpen: false });
  const [isDrawingCanvasOpen, setIsDrawingCanvasOpen] = useState(false);
  const [vectorDesignState, setVectorDesignState] = useState<{ isOpen: boolean; prompt?: string }>({ isOpen: false });

  // Icon Movement State
  const [iconPositions, setIconPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const saved = localStorage.getItem('icos_icon_positions');
    return saved ? JSON.parse(saved) : {};
  });

  const [taskbarPosition, setTaskbarPosition] = useState<{ x: number; y: number }>(() => {
    const saved = localStorage.getItem('icos_taskbar_position');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  const [sidebarPosition, setSidebarPosition] = useState<{ x: number; y: number }>(() => {
    const saved = localStorage.getItem('icos_sidebar_position');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });

  useEffect(() => {
    localStorage.setItem('icos_icon_positions', JSON.stringify(iconPositions));
  }, [iconPositions]);

  useEffect(() => {
    localStorage.setItem('icos_taskbar_position', JSON.stringify(taskbarPosition));
  }, [taskbarPosition]);

  useEffect(() => {
    localStorage.setItem('icos_sidebar_position', JSON.stringify(sidebarPosition));
  }, [sidebarPosition]);

  // AIOperator Voice Hook
  const voiceOperator = useAIOperatorVoice({
    aiConfig,
    installedApps: installedAppsList,
    hardwareStatus,
    onLaunchApp: (app) => handleLaunchApp(app),
    onCreateFolder: () => handleCreateFolder(),
    onCreatePdf: () => handleCreatePdf(),
    onCreateWebsiteShortcut: () => setIsNewWebsiteModalOpen(true),
    onRefreshDesktop: () => handleRefreshDesktop(),
    onOpenSettings,
    onOpenCodeStudio: (code, title) => setCodeStudioState({ isOpen: true, code, title }),
    onOpen3DModeler: (shape, title) => setSpatial3DState({ isOpen: true, shape, title }),
    onOpenVectorDesign: (prompt) => setVectorDesignState({ isOpen: true, prompt }),
    onOpenDrawingCanvas: () => setIsDrawingCanvasOpen(true),
    onOpenDeviceSetup: () => setIsDeviceSetupOpen(true),
    onSwitchFormFactor: (mode) => formFactor.setFormFactor(mode),
  });

  // Desktop Context Menu & New Item Modals State
  const [desktopContextMenuPos, setDesktopContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isNewWebsiteModalOpen, setIsNewWebsiteModalOpen] = useState(false);

  const handleCreateFolder = () => {
    const folderCount = installedAppsList.filter((a) => a.capabilities?.includes('folder')).length;
    const folderName = folderCount === 0 ? 'New Folder' : `New Folder (${folderCount})`;
    const folderApp: RegisteredApplication = {
      id: `local.folder.${Date.now()}`,
      name: folderName,
      description: 'Interactive Desktop Folder',
      iconResource: '/icons/ic-app-launcher-icon.svg',
      version: '1.0.0',
      publisher: 'Local User',
      source: 'third-party',
      installed: true,
      available: true,
      filesPresent: true,
      supportedPlatforms: ['web', 'windows', 'macos', 'linux', 'android', 'ios'],
      launchMethod: 'external-web-url',
      verifiedLaunchTarget: 'https://localhost/files',
      signatureVerified: true,
      permissions: ['files:read', 'files:write'],
      capabilities: ['folder', 'filesystem'],
      runtimeType: 'web-app',
      installedAt: new Date().toISOString(),
    };
    applicationRegistry.registerVerifiedApplication(folderApp);
    setInstalledAppsList((prev) => [...prev, folderApp]);
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId: folderApp.id,
      appName: folderApp.name,
      initiated: true,
      confirmedByPlatform: true,
      userMessage: `Folder "${folderName}" created on Desktop.`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleCreatePdf = () => {
    const pdfCount = installedAppsList.filter((a) => a.capabilities?.includes('pdf-document')).length;
    const pdfName = pdfCount === 0 ? 'New Document.pdf' : `New Document (${pdfCount}).pdf`;
    const pdfApp: RegisteredApplication = {
      id: `local.pdf.${Date.now()}`,
      name: pdfName,
      description: 'PDF Document Shortcut',
      iconResource: '/icons/ic-app-launcher-icon.svg',
      version: '1.0.0',
      publisher: 'Local User',
      source: 'third-party',
      installed: true,
      available: true,
      filesPresent: true,
      supportedPlatforms: ['web', 'windows', 'macos', 'linux'],
      launchMethod: 'external-web-url',
      verifiedLaunchTarget: 'https://localhost/reader',
      signatureVerified: true,
      permissions: ['files:read'],
      capabilities: ['pdf-document', 'document'],
      runtimeType: 'web-app',
      installedAt: new Date().toISOString(),
    };
    applicationRegistry.registerVerifiedApplication(pdfApp);
    setInstalledAppsList((prev) => [...prev, pdfApp]);
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId: pdfApp.id,
      appName: pdfApp.name,
      initiated: true,
      confirmedByPlatform: true,
      userMessage: `PDF Document "${pdfName}" created on Desktop.`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleCreateWebsiteShortcut = (newApp: RegisteredApplication) => {
    applicationRegistry.registerVerifiedApplication(newApp);
    setInstalledAppsList((prev) => [...prev, newApp]);
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId: newApp.id,
      appName: newApp.name,
      initiated: true,
      confirmedByPlatform: true,
      userMessage: `Website shortcut "${newApp.name}" (${newApp.verifiedLaunchTarget}) created on Desktop.`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleCreateShortcut = () => {
    setIsSearchVisible(true);
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId: 'system',
      appName: 'Shortcut Wizard',
      initiated: true,
      confirmedByPlatform: true,
      userMessage: 'Select an application from the catalog to pin or launch.',
      timestamp: new Date().toISOString(),
    });
  };

  const handleRefreshDesktop = () => {
    setInstalledAppsList([...applicationRegistry.getInstalledApplications()]);
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId: 'system',
      appName: 'Desktop',
      initiated: true,
      confirmedByPlatform: true,
      userMessage: 'Desktop shortcuts and items refreshed.',
      timestamp: new Date().toISOString(),
    });
  };

  const handleArrangeIcons = () => {
    setIconPositions({});
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId: 'system',
      appName: 'Desktop',
      initiated: true,
      confirmedByPlatform: true,
      userMessage: 'Desktop icons arranged neatly in the grid.',
      timestamp: new Date().toISOString(),
    });
  };

  // Sync initial apps
  useEffect(() => {
    setInstalledAppsList([...initialApps]);
  }, [initialApps]);

  // Filter apps by search query and removed status
  const visibleDesktopApps = installedAppsList.filter((app) => !removedAppIds.includes(app.id));
  const searchFilteredApps = filterInstalledApplications(visibleDesktopApps, searchQuery);

  const [activeWorkspaces, setActiveWorkspaces] = useState<AppWorkspace[]>([]);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);

  const activeFocusedWindow = activeWorkspaces.find((w) => w.windowId === focusedWindowId);

  const handleLaunchApp = async (app: RegisteredApplication, forceNewInstance: boolean = false) => {
    const result = await platformAppLauncher.launchExternalApplication(app);
    setLastLaunchResult(result);

    const existing = activeWorkspaces.find((w) => w.app.id === app.id);
    if (existing && !forceNewInstance) {
      setActiveWorkspaces((prev) =>
        prev.map((w) =>
          w.windowId === existing.windowId ? { ...w, isMinimized: false, zIndex: Date.now() } : w
        )
      );
      setFocusedWindowId(existing.windowId);
    } else {
      const newWindow: AppWorkspace = {
        windowId: `win_${app.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        app,
        isMinimized: false,
        isMaximized: false,
        position: { x: 40 + activeWorkspaces.length * 20, y: 40 + activeWorkspaces.length * 20 },
        size: { width: 900, height: 600 },
        zIndex: Date.now(),
      };
      setActiveWorkspaces((prev) => [...prev, newWindow]);
      setFocusedWindowId(newWindow.windowId);
    }

    setIsSearchVisible(false);
    setSearchQuery('');
  };

  const handleFocusWindow = (windowId: string) => {
    setFocusedWindowId(windowId);
    setActiveWorkspaces((prev) =>
      prev.map((w) => (w.windowId === windowId ? { ...w, zIndex: Date.now() } : w))
    );
  };

  const handleCloseWindow = (windowId: string) => {
    setActiveWorkspaces((prev) => prev.filter((w) => w.windowId !== windowId));
    if (focusedWindowId === windowId) {
      setFocusedWindowId(null);
    }
  };

  const handleCloseAllWindows = () => {
    setActiveWorkspaces([]);
    setFocusedWindowId(null);
  };

  const handleMinimizeWindow = (windowId: string) => {
    setActiveWorkspaces((prev) =>
      prev.map((w) => (w.windowId === windowId ? { ...w, isMinimized: true } : w))
    );
  };

  const handleToggleMaximizeWindow = (windowId: string) => {
    setActiveWorkspaces((prev) =>
      prev.map((w) => (w.windowId === windowId ? { ...w, isMaximized: !w.isMaximized, snapPosition: null } : w))
    );
  };

  const handleApplySnapLayout = (
    windowId: string, 
    snapPosition: 'full' | 'left-half' | 'right-half' | 'left-two-thirds' | 'right-one-third' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  ) => {
    setActiveWorkspaces((prev) =>
      prev.map((w) =>
        w.windowId === windowId
          ? { 
              ...w, 
              isMinimized: false, 
              isMaximized: snapPosition === 'full', 
              snapPosition, 
              zIndex: Date.now() 
            }
          : w
      )
    );
    setFocusedWindowId(windowId);
  };

  // App Action Menu Handlers
  const handleRemoveFromDesktop = (appId: string) => {
    setRemovedAppIds((prev) => [...prev, appId]);
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId,
      appName: appId,
      initiated: true,
      confirmedByPlatform: true,
      userMessage: `Shortcut removed from Desktop grid. App remains in OS catalog.`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleUninstallApp = (appId: string) => {
    const targetApp = installedAppsList.find((a) => a.id === appId) || initialApps.find((a) => a.id === appId);
    const appDisplayName = targetApp ? targetApp.name : appId;

    // 1. Permanently unregister from storage and record tombstone ID
    applicationRegistry.unregisterApplication(appId);

    // 2. Synchronously remove from all UI state domains so UI reacts immediately
    setInstalledAppsList((prev) => prev.filter((a) => a.id !== appId));
    setRemovedAppIds((prev) => (prev.includes(appId) ? prev : [...prev, appId]));
    setActiveWorkspaces((prev) => prev.filter((w) => w.app.id !== appId));
    setSidebarAppIds((prev) => prev.filter((id) => id !== appId));

    // 3. Remove from pinned taskbar preferences
    if (onUpdatePreferences) {
      onUpdatePreferences((prev) => ({
        ...prev,
        pinnedAppIds: prev.pinnedAppIds.filter((id) => id !== appId),
      }));
    }

    // 4. Close any open action menu or info modal
    setSelectedActionApp(null);
    setSelectedInfoApp(null);

    // 5. Broadcast change event for global sync
    try {
      window.dispatchEvent(new Event('icy-registry-changed'));
    } catch {}

    // 6. Visual confirmation notification
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId,
      appName: appDisplayName,
      initiated: true,
      confirmedByPlatform: true,
      userMessage: `"${appDisplayName}" uninstalled permanently from ICOS.`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleTogglePinTaskbar = (appId: string) => {
    onUpdatePreferences?.((prev) => {
      const isPinned = prev.pinnedAppIds.includes(appId);
      const updatedPinned = isPinned
        ? prev.pinnedAppIds.filter((id) => id !== appId)
        : [...prev.pinnedAppIds, appId];
      return { ...prev, pinnedAppIds: updatedPinned };
    });
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId,
      appName: appId,
      initiated: true,
      confirmedByPlatform: true,
      userMessage: `Taskbar pinned apps updated.`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleTogglePinSidebar = (appId: string) => {
    setSidebarAppIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
    setLastLaunchResult({
      status: 'launch-request-accepted',
      appId,
      appName: appId,
      initiated: true,
      confirmedByPlatform: true,
      userMessage: `Sidebar shortcuts updated.`,
      timestamp: new Date().toISOString(),
    });
  };

  const isSafeImageIconUrl = (iconResource: string): boolean => {
    const trimmed = iconResource.trim().toLowerCase();
    return (
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('/')
    );
  };

  useEffect(() => {
    if (isSearchVisible) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isSearchVisible]);

  useEffect(() => {
    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.key.toUpperCase()] = true;

      // Shortcut: Control + Shift + H + T (Hide)
      if (e.ctrlKey && e.shiftKey && keysPressed['H'] && keysPressed['T']) {
        e.preventDefault();
        setIsShellHidden(true);
      }
      // Shortcut: Control + Shift + S + T (Show)
      if (e.ctrlKey && e.shiftKey && keysPressed['S'] && keysPressed['T']) {
        e.preventDefault();
        setIsShellHidden(false);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchVisible((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsSearchVisible(false);
        setSelectedActionApp(null);
        setSelectedInfoApp(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key.toUpperCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <WallpaperBackground wallpaper={preferences.wallpaper} blur={isSearchVisible}>
      

      {/* 2. Main Desktop Workspace Area */}
      <main 
        ref={desktopRef}
        onContextMenu={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('button') && !target.closest('.no-desktop-menu')) {
            e.preventDefault();
            setDesktopContextMenuPos({ x: e.clientX, y: e.clientY });
          }
        }}
        onClick={(e) => {
          // Close context menu if clicking anywhere
          if (desktopContextMenuPos) {
            setDesktopContextMenuPos(null);
          }
        }}
        className="relative z-10 w-full h-full flex flex-col px-4 sm:px-8 md:px-10 pt-5 sm:pt-7 pb-0 overflow-hidden"
      >
        
        {/* Top HUD Bar: Compact Clock, Search Bar & AI Operator */}
        <header className="w-full max-w-[1600px] mx-auto flex flex-wrap md:flex-nowrap items-center justify-between gap-4 z-20 shrink-0 pb-3 sm:pb-4 border-b border-white/10">
          <div className="flex flex-col text-left shrink-0">
            <time className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight tabular-clock leading-none text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.85)] font-mono">
              {clock.hoursMinutes}
            </time>
            <p className="mt-1.5 text-[11px] sm:text-xs font-semibold tracking-wider text-cyan-200/90 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
              {clock.dateText}
            </p>
          </div>

          {!isSearchVisible && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setIsSearchVisible(true)}
              className="order-3 md:order-2 w-full md:w-auto md:flex-1 md:max-w-lg px-4 py-2.5 rounded-2xl icos-shell-bg hover:opacity-95 backdrop-blur-2xl icos-shell-border border shadow-xl flex items-center justify-between text-white transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <Search className="w-4 h-4 icos-accent-text shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-white/90 truncate">Search applications & shortcuts...</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold bg-white/15 rounded-md text-white border border-white/25 shrink-0 ml-2">
                ⌘K
              </kbd>
            </motion.button>
          )}

          <div className="order-2 md:order-3 flex items-center justify-end shrink-0">
            {preferences.aiOperatorEnabled && (
              <AIOperator 
                aiConfig={aiConfig} 
                isVoiceActive={voiceOperator.isActive}
                isSpeaking={voiceOperator.isSpeaking}
                isProcessing={voiceOperator.isProcessing}
                onToggle={voiceOperator.toggleVoice}
              />
            )}
          </div>
        </header>

        {/* Spacious Desktop Application Canvas */}
        {!isSearchVisible && (
          <div className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto mt-3 sm:mt-5 overflow-y-auto icos-scrollbar pt-3 pb-32 px-1 sm:px-3 sm:pr-20 z-10">
            {searchFilteredApps.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(118px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-7 auto-rows-max content-start justify-items-center">
                {searchFilteredApps.map((app) => (
                  <DesktopIcon 
                    key={app.id} 
                    app={app} 
                    position={iconPositions[app.id]}
                    dragConstraints={desktopRef}
                    onOpenAppMenu={(selectedApp) => setSelectedActionApp(selectedApp)}
                    onLaunch={() => handleLaunchApp(app)}
                    onMove={(pos) => setIconPositions(prev => ({ ...prev, [app.id]: pos }))}
                    failedIconIds={failedIconIds}
                    setFailedIconIds={setFailedIconIds}
                    isSafeImageIconUrl={isSafeImageIconUrl}
                  />
                ))}
              </div>
            ) : (
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center px-4 text-white/60">
                <p className="text-sm font-medium text-white/75">No applications on Desktop yet.</p>
                <p className="mt-1.5 text-xs text-white/50 max-w-md">
                  Right-click anywhere on the desktop to create folders, PDFs, or website shortcuts.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 3. Floating ICOS Taskbar (Centered at Bottom) */}
        <AnimatePresence>
          {!isShellHidden && (
            <motion.div 
              drag
              dragMomentum={false}
              initial={taskbarPosition}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              onDragEnd={(_, info) => setTaskbarPosition({ x: info.point.x, y: info.point.y })}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]"
            >
              <Taskbar 
                installedApps={installedAppsList} 
                pinnedAppIds={preferences.pinnedAppIds}
                activeWorkspaces={activeWorkspaces}
                focusedWindowId={focusedWindowId}
                onOpenSettings={onOpenSettings} 
                onLaunch={(app) => handleLaunchApp(app)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. Quick Action Sidebar (Right Edge) */}
        <AnimatePresence>
          {!isShellHidden && (
            <motion.div 
              drag
              dragMomentum={false}
              initial={sidebarPosition}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              onDragEnd={(_, info) => setSidebarPosition({ x: info.point.x, y: info.point.y })}
              className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] hidden sm:block"
            >
              <Sidebar 
                installedApps={installedAppsList} 
                sidebarAppIds={sidebarAppIds}
                onLaunch={(app) => handleLaunchApp(app)} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 5. Active OS Application Workspaces */}
      {activeWorkspaces.map((win) => (
        <IcosAppShell
          key={win.windowId}
          windowState={win}
          onFocus={handleFocusWindow}
          onClose={handleCloseWindow}
          onMinimize={handleMinimizeWindow}
          onToggleMaximize={handleToggleMaximizeWindow}
          onApplySnapLayout={handleApplySnapLayout}
          onUpdatePosition={() => {}}
        />
      ))}

      {/* 6. Left-Click App Context Menu (App Info, Remove, Uninstall, Pin Taskbar, Pin Sidebar) */}
      {selectedActionApp && (
        <AppActionMenu
          app={selectedActionApp}
          isOpen={Boolean(selectedActionApp)}
          isPinnedToTaskbar={preferences.pinnedAppIds.includes(selectedActionApp.id)}
          isPinnedToSidebar={sidebarAppIds.includes(selectedActionApp.id)}
          onClose={() => setSelectedActionApp(null)}
          onLaunch={handleLaunchApp}
          onShowInfo={(app) => setSelectedInfoApp(app)}
          onRemoveFromDesktop={handleRemoveFromDesktop}
          onUninstall={handleUninstallApp}
          onTogglePinTaskbar={handleTogglePinTaskbar}
          onTogglePinSidebar={handleTogglePinSidebar}
        />
      )}

      {/* 7. Detailed App Info Modal */}
      <AppInfoModal
        app={selectedInfoApp}
        isOpen={Boolean(selectedInfoApp)}
        onClose={() => setSelectedInfoApp(null)}
        onLaunch={handleLaunchApp}
        onUninstall={handleUninstallApp}
      />

      {/* 7b. Desktop Blank-Space Context Menu (Left-Click or Right-Click on empty area) */}
      {desktopContextMenuPos && (
        <DesktopContextMenu
          position={desktopContextMenuPos}
          onClose={() => setDesktopContextMenuPos(null)}
          onCreateFolder={handleCreateFolder}
          onCreatePdf={handleCreatePdf}
          onCreateWebsiteShortcut={() => setIsNewWebsiteModalOpen(true)}
          onCreateShortcut={handleCreateShortcut}
          onRefreshDesktop={handleRefreshDesktop}
          onArrangeIcons={handleArrangeIcons}
          onOpenSettings={onOpenSettings}
          onOpenTerminal={
            installedAppsList.some((a) => a.id === 'com.icy.terminal')
              ? () => {
                  const terminalApp = installedAppsList.find((a) => a.id === 'com.icy.terminal');
                  if (terminalApp) handleLaunchApp(terminalApp);
                }
              : undefined
          }
        />
      )}

      {/* 7c. New Website Shortcut Modal Prompt */}
      <NewWebsiteShortcutModal
        isOpen={isNewWebsiteModalOpen}
        onClose={() => setIsNewWebsiteModalOpen(false)}
        onCreateWebsiteShortcut={handleCreateWebsiteShortcut}
      />

      {/* Creative Modules & System Modals */}
      <DeviceSetupModal
        isOpen={isDeviceSetupOpen}
        onClose={() => setIsDeviceSetupOpen(false)}
        formFactorState={formFactor}
      />

      <CodeRunnerModal
        isOpen={codeStudioState.isOpen}
        onClose={() => setCodeStudioState({ isOpen: false })}
        initialCode={codeStudioState.code}
        title={codeStudioState.title}
      />

      <Spatial3DModelerModal
        isOpen={spatial3DState.isOpen}
        onClose={() => setSpatial3DState({ isOpen: false })}
        initialShape={spatial3DState.shape}
        modelTitle={spatial3DState.title}
      />

      <DrawingCanvasModal
        isOpen={isDrawingCanvasOpen}
        onClose={() => setIsDrawingCanvasOpen(false)}
      />

      <VectorDesignModal
        isOpen={vectorDesignState.isOpen}
        onClose={() => setVectorDesignState({ isOpen: false })}
        designPrompt={vectorDesignState.prompt}
      />

      {/* 12. Spotlight Application Search Overlay */}
      <AnimatePresence>
        {isSearchVisible && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-start justify-center pt-16 sm:pt-24 p-4"
            onClick={() => setIsSearchVisible(false)}
          >
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: -12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: -12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-5xl icos-shell-bg icos-shell-border border rounded-3xl shadow-2xl overflow-hidden backdrop-blur-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-white/10 relative flex items-center">
                <Search className="w-6 h-6 icos-accent-text absolute left-6 pointer-events-none" />
                <input 
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search installed applications..."
                  className="w-full bg-transparent text-white text-lg sm:text-xl pl-12 pr-12 focus:outline-none placeholder:text-white/40"
                />
                <button 
                  onClick={() => setIsSearchVisible(false)}
                  className="absolute right-5 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[72vh] overflow-y-auto icos-scrollbar p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {searchFilteredApps.map((app) => (
                  <button 
                    key={app.id}
                    onClick={() => {
                      handleLaunchApp(app);
                      setIsSearchVisible(false);
                    }}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/40 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                        {isSafeImageIconUrl(app.iconResource) && !failedIconIds[app.id] ? (
                          <img 
                            src={app.iconResource} 
                            alt={app.name} 
                            className="w-full h-full object-cover"
                            onError={() => setFailedIconIds(prev => ({ ...prev, [app.id]: true }))}
                          />
                        ) : (
                          <span className="text-white text-base font-bold">{app.name[0]}</span>
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-white font-medium text-sm truncate group-hover:text-blue-200 transition-colors">{app.name}</span>
                        <span className="text-white/40 text-xs truncate">{app.publisher} · {app.runtimeType}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                ))}

                {searchFilteredApps.length === 0 && (
                  <div className="col-span-full py-12 text-center text-white/40 text-sm">
                    {searchQuery.trim()
                      ? <>No applications found matching &ldquo;{searchQuery}&rdquo;</>
                      : 'No applications are currently installed in ICOS.'}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Toast Notification for Launch Results */}
      <AnimatePresence>
        {lastLaunchResult && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl border backdrop-blur-2xl shadow-2xl flex items-center gap-4 ${
              lastLaunchResult.initiated 
                ? 'bg-slate-900/90 border-blue-500/40 text-blue-100' 
                : 'bg-rose-950/90 border-rose-500/40 text-rose-100'
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{lastLaunchResult.userMessage}</span>
            </div>
            <button 
              onClick={() => setLastLaunchResult(null)} 
              className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </WallpaperBackground>
  );
};

const DesktopIcon: React.FC<{
  app: RegisteredApplication;
  position?: { x: number; y: number };
  dragConstraints?: React.RefObject<HTMLDivElement | null>;
  onOpenAppMenu: (app: RegisteredApplication) => void;
  onLaunch: () => void;
  onMove: (pos: { x: number; y: number }) => void;
  failedIconIds: Record<string, boolean>;
  setFailedIconIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isSafeImageIconUrl: (url: string) => boolean;
}> = ({ app, position, dragConstraints, onOpenAppMenu, onLaunch, onMove, failedIconIds, setFailedIconIds, isSafeImageIconUrl }) => {
  const dragControls = useDragControls();
  const offsetX = position?.x ?? 0;
  const offsetY = position?.y ?? 0;

  return (
    <motion.button
      drag
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={dragConstraints}
      dragElastic={0.08}
      dragMomentum={false}
      animate={{ x: offsetX, y: offsetY }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onDragEnd={(_, info) => {
        onMove({
          x: offsetX + info.offset.x,
          y: offsetY + info.offset.y,
        });
      }}
      whileHover={{ y: -4, scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      whileDrag={{ scale: 1.06, zIndex: 50 }}
      onPointerDown={(e) => {
        if (e.button === 2) {
          dragControls.start(e);
        }
      }}
      onClick={() => {
        onLaunch();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenAppMenu(app);
      }}
      className="w-full max-w-[124px] flex flex-col items-center gap-2.5 p-2.5 rounded-2xl border border-transparent hover:bg-white/10 hover:border-white/15 transition-colors duration-150 cursor-pointer group select-none"
      title={`${app.name} (${app.publisher}) — Click to open, right-click for options`}
    >
      <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg flex items-center justify-center overflow-hidden transition-all duration-150 group-hover:border-white/35 group-hover:shadow-xl shrink-0">
        {isSafeImageIconUrl(app.iconResource) && !failedIconIds[app.id] ? (
          <img 
            src={app.iconResource} 
            alt={app.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover pointer-events-none"
            onError={() => setFailedIconIds(prev => ({ ...prev, [app.id]: true }))}
          />
        ) : (
          <span className="text-white text-2xl font-bold font-mono">{app.name[0]}</span>
        )}
      </div>
      <span className="w-full text-white text-xs font-medium leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] text-center line-clamp-2 break-words group-hover:text-blue-200 transition-colors">
        {app.name}
      </span>
    </motion.button>
  );
};

/* --- ICOS Taskbar Sub-component --- */

const Taskbar: React.FC<{
  installedApps: readonly RegisteredApplication[];
  pinnedAppIds: string[];
  activeWorkspaces: AppWorkspace[];
  focusedWindowId: string | null;
  onOpenSettings: () => void;
  onLaunch: (app: RegisteredApplication) => void;
}> = ({ 
  installedApps, 
  pinnedAppIds, 
  activeWorkspaces, 
  focusedWindowId, 
  onOpenSettings, 
  onLaunch 
}) => {
  const pinnedApps = installedApps.filter((app) => pinnedAppIds.includes(app.id));
  const fallbackPinned = pinnedApps.length > 0 ? pinnedApps : installedApps.slice(0, 5);

  const runningUnpinnedApps = activeWorkspaces
    .map((w) => w.app)
    .filter((app, index, self) => 
      !fallbackPinned.some((p) => p.id === app.id) && self.findIndex((a) => a.id === app.id) === index
    );

  const displayTaskbarApps = [...fallbackPinned, ...runningUnpinnedApps];

  return (
    <motion.div 
      drag
      dragMomentum={false}
      whileDrag={{ scale: 1.02, opacity: 0.95, cursor: 'grabbing' }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="icos-shell-bg backdrop-blur-3xl icos-shell-border border h-16 px-6 rounded-3xl flex items-center gap-4 shadow-2xl select-none cursor-grab active:cursor-grabbing"
    >

      <div className="flex items-center gap-1.5">
        {displayTaskbarApps.map((app) => {
          const matchingWindows = activeWorkspaces.filter((w) => w.app.id === app.id);
          const instanceCount = matchingWindows.length;
          const isOpen = instanceCount > 0;
          const isFocused = matchingWindows.some((w) => w.windowId === focusedWindowId);

          return (
            <button 
              key={app.id}
              onClick={() => onLaunch(app)}
              className={`w-12 h-12 rounded-xl hover:bg-white/15 flex items-center justify-center transition-all cursor-pointer group relative ${
                isFocused ? 'bg-white/15 border border-blue-400/40' : ''
              }`}
              title={`${app.name}${instanceCount > 0 ? ` (${instanceCount} instance${instanceCount > 1 ? 's' : ''})` : ''}`}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 overflow-hidden flex items-center justify-center shadow-md group-hover:border-blue-400/50">
                <span className="text-white text-xs font-bold font-mono">{app.name[0]}</span>
              </div>

              {instanceCount > 1 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-blue-600 text-white text-[9px] font-mono font-bold">
                  {instanceCount}
                </span>
              )}

              {isFocused ? (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              ) : isOpen ? (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="h-8 w-px bg-white/15 mx-1" />

      <button 
        onClick={onOpenSettings}
        className="w-12 h-12 rounded-xl hover:bg-white/15 flex items-center justify-center transition-all cursor-pointer group"
        title="ICOS Settings"
      >
        <Settings className="w-5 h-5 text-white/70 group-hover:rotate-90 group-hover:text-white transition-all duration-300" />
      </button>
    </motion.div>
  );
};

/* --- Sidebar Sub-component --- */

const Sidebar: React.FC<{
  installedApps: readonly RegisteredApplication[];
  sidebarAppIds: string[];
  onLaunch: (app: RegisteredApplication) => void;
}> = ({ installedApps, sidebarAppIds, onLaunch }) => {
  const sidebarApps = installedApps.filter((a) => sidebarAppIds.includes(a.id));
  const displaySidebarApps = sidebarApps.length > 0 ? sidebarApps : installedApps.slice(0, 3);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <motion.div 
      drag
      dragMomentum={false}
      whileDrag={{ scale: 1.05, opacity: 0.95, cursor: 'grabbing' }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="icos-shell-bg backdrop-blur-3xl icos-shell-border border w-14 py-3 rounded-2xl flex flex-col gap-2 shadow-2xl items-center cursor-grab active:cursor-grabbing"
    >
      {installPrompt && (
        <button 
          onClick={handleInstall}
          className="w-10 h-10 rounded-xl bg-blue-600/40 border border-blue-400/50 flex items-center justify-center transition-all cursor-pointer group mb-2"
          title="Install ICOS OS"
        >
          <Plus className="w-5 h-5 text-blue-400 group-hover:scale-125 transition-transform" />
        </button>
      )}

      {displaySidebarApps.map((app) => (
        <button 
          key={app.id}
          onClick={() => onLaunch(app)}
          className="w-10 h-10 rounded-xl hover:bg-white/15 flex items-center justify-center transition-all cursor-pointer group"
          title={app.name}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 overflow-hidden flex items-center justify-center text-xs font-bold text-white group-hover:border-purple-400/50">
            {app.name[0]}
          </div>
        </button>
      ))}
    </motion.div>
  );
};

const AIOperator: React.FC<{ 
  aiConfig: PersonalizedAIConfig;
  isVoiceActive: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  onToggle: () => void;
}> = ({ isVoiceActive, isSpeaking, isProcessing, onToggle }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex items-center justify-center"
    >
      <button 
        onClick={onToggle}
        className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center cursor-pointer group outline-none"
      >
        {/* Immersive Ambient Glow */}
        <AnimatePresence>
          {(isVoiceActive || isSpeaking || isProcessing) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1.3 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className={`absolute inset-0 rounded-full blur-2xl ${
                isVoiceActive ? 'bg-cyan-500/40' : isSpeaking ? 'bg-purple-600/40' : 'bg-blue-600/20'
              }`}
            />
          )}
        </AnimatePresence>

        {/* Dynamic Outer Rings */}
        <motion.div 
          animate={{ 
            rotate: 360,
            scale: isVoiceActive ? 1.15 : 1,
            borderColor: isVoiceActive ? "rgba(34, 211, 238, 0.7)" : isSpeaking ? "rgba(168, 85, 247, 0.7)" : "rgba(255, 255, 255, 0.2)"
          }}
          transition={{ rotate: { duration: 12, repeat: Infinity, ease: "linear" }, scale: { duration: 0.4 } }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-white/20"
        />
        
        <motion.div 
          animate={{ 
            rotate: -360,
            scale: isVoiceActive ? 1.05 : 1,
          }}
          transition={{ rotate: { duration: 8, repeat: Infinity, ease: "linear" } }}
          className="absolute inset-2 rounded-full border border-white/10"
        />

        {/* High-Performance Neural Core */}
        <div className={`relative w-12 h-12 sm:w-14 sm:h-14 bg-[#05070a]/90 backdrop-blur-3xl rounded-full border flex items-center justify-center overflow-hidden shadow-2xl transition-all duration-700 ${
          isVoiceActive ? 'border-cyan-400/60' : isSpeaking ? 'border-purple-400/60' : 'border-white/20 group-hover:border-white/40'
        }`}>
          <div className={`absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] ${
            isVoiceActive ? 'from-cyan-500' : isSpeaking ? 'from-purple-500' : 'from-blue-500'
          }`} />
          
          <div className="relative w-full h-full flex items-center justify-center">
            {isVoiceActive ? (
              <motion.div 
                className="flex items-center gap-1.5"
              >
                {[0, 1, 2, 3, 4].map(i => (
                  <motion.div 
                    key={i}
                    animate={{ 
                      height: [8, 28, 10, 24, 8],
                      opacity: [0.6, 1, 0.6]
                    }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                    className="w-1 bg-gradient-to-b from-cyan-300 to-blue-500 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                  />
                ))}
              </motion.div>
            ) : isSpeaking ? (
              <div className="relative flex items-center justify-center">
                <motion.div 
                  animate={{ scale: [1, 2.8, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="absolute w-10 h-10 rounded-full border-2 border-purple-400/40"
                />
                <motion.div 
                  animate={{ scale: [0.85, 1.4, 0.85] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-600 shadow-[0_0_20px_rgba(168,85,247,0.8)]"
                />
              </div>
            ) : isProcessing ? (
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                 className="w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-full"
               />
            ) : (
              <div className="relative group-hover:scale-110 transition-transform duration-700">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="w-7 h-7 border border-cyan-400/20 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-cyan-400/80 rounded-sm rotate-45 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.4)]">
                    <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_15px_#fff] animate-pulse" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  );
};
