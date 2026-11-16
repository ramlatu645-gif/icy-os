/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Minus, 
  Square, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  ExternalLink, 
  Terminal, 
  Smartphone, 
  Monitor, 
  Apple, 
  Globe, 
  ShieldCheck, 
  Cpu, 
  Sparkles,
  ChevronLeft,
  Home,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RegisteredApplication } from '../../types/launcher';
import { IcyWebBrowser } from './IcyWebBrowser';
import { IcyFileExplorer } from './IcyFileExplorer';
import { IcyPdfStudio } from './IcyPdfStudio';

export interface AppWorkspace {
  windowId: string;
  app: RegisteredApplication;
  isMinimized: boolean;
  isMaximized: boolean;
  snapPosition?: 'full' | 'left-half' | 'right-half' | 'left-two-thirds' | 'right-one-third' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

interface IcosAppShellProps {
  windowState: AppWorkspace;
  onFocus: (windowId: string) => void;
  onClose: (windowId: string) => void;
  onMinimize: (windowId: string) => void;
  onToggleMaximize: (windowId: string) => void;
  onApplySnapLayout?: (windowId: string, snap: 'full' | 'left-half' | 'right-half' | 'left-two-thirds' | 'right-one-third' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => void;
  onUpdatePosition: (windowId: string, pos: { x: number; y: number }) => void;
}

export const IcosAppShell: React.FC<IcosAppShellProps> = ({
  windowState,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onApplySnapLayout,
}) => {
  const { app, isMinimized, isMaximized, snapPosition, zIndex } = windowState;
  const [activeTab, setActiveTab] = useState<'app' | 'logs' | 'info'>('app');
  const [iframeUrl, setIframeUrl] = useState(app.verifiedLaunchTarget);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (isMinimized) return null;

  // Determine platform type badge and theme
  const isAndroid = app.supportedPlatforms.includes('android') || app.launchMethod === 'android-intent';
  const isIOS = app.supportedPlatforms.includes('ios') || app.launchMethod === 'ios-url-scheme';
  const isDesktop = app.supportedPlatforms.includes('windows') && !isAndroid && !isIOS;
  const isMacOS = app.supportedPlatforms.includes('macos') && !isAndroid && !isIOS;
  const isLinux = app.supportedPlatforms.includes('linux') && !isDesktop && !isMacOS && !isAndroid && !isIOS;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getPlatformIcon = () => {
    if (isAndroid) return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
    if (isIOS) return <Apple className="w-3.5 h-3.5 text-slate-300" />;
    if (isDesktop) return <Monitor className="w-3.5 h-3.5 text-sky-400" />;
    if (isLinux || isMacOS) return <Terminal className="w-3.5 h-3.5 text-amber-400" />;
    return <Globe className="w-3.5 h-3.5 text-blue-400" />;
  };

  const getPlatformBadge = () => {
    if (isAndroid) return 'Android APK';
    if (isIOS) return 'iOS IPA';
    if (isDesktop) return 'ICOS Native';
    if (isMacOS) return 'macOS App';
    if (isLinux) return 'Linux Binary';
    return 'ICY Web App';
  };

  // Safe external opener for apps that cannot run inside iframes
  const handleOpenExternal = () => {
    if (typeof window !== 'undefined') {
      window.open(app.verifiedLaunchTarget, '_blank', 'noopener,noreferrer');
    }
  };

  // Resolve layout CSS based on snapPosition or isMaximized
  const getLayoutClasses = () => {
    if (isMaximized) {
      return 'inset-0 z-40 rounded-none';
    }
    return 'top-12 sm:top-16 left-4 sm:left-12 right-4 sm:right-12 bottom-20 sm:bottom-24 max-w-5xl mx-auto rounded-2xl';
  };

  return (
    <AnimatePresence>
      <motion.div
        drag={!isMaximized}
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={() => onFocus(windowState.windowId)}
        style={{
          zIndex,
        }}
        className={`fixed transition-all duration-300 flex flex-col overflow-hidden border shadow-2xl backdrop-blur-3xl select-none ${getLayoutClasses()} ${
          isAndroid
            ? 'bg-slate-950/95 border-emerald-500/30 shadow-emerald-900/20'
            : isIOS
            ? 'bg-slate-950/95 border-slate-700/50 shadow-slate-900/40'
            : isDesktop
            ? 'bg-slate-900/95 border-sky-500/30 shadow-sky-900/20'
            : 'icos-shell-bg icos-shell-border shadow-black/60'
        }`}
      >
      {/* OS Titlebar */}
      <div className="h-11 px-4 icos-shell-bg icos-shell-border border-b flex items-center justify-between shrink-0 cursor-move">
        {/* Left Controls / Title */}
        <div className="flex items-center gap-3 overflow-hidden">
          {/* macOS Style Traffic Light buttons for macOS/Linux */}
          {(isMacOS || isLinux) && (
            <div className="flex items-center gap-1.5 mr-1">
              <button 
                onClick={(e) => { e.stopPropagation(); onClose(windowState.windowId); }}
                className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 transition-colors cursor-pointer" 
                title="Close"
              />
              <button 
                onClick={(e) => { e.stopPropagation(); onMinimize(windowState.windowId); }}
                className="w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer" 
                title="Minimize"
              />
              <button 
                onClick={(e) => { e.stopPropagation(); onToggleMaximize(windowState.windowId); }}
                className="w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors cursor-pointer" 
                title="Maximize"
              />
            </div>
          )}

          {/* App Icon & Badge */}
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center font-mono text-xs font-bold text-white shrink-0">
              {app.name[0]}
            </div>
            <span className="text-xs font-semibold text-white truncate max-w-[180px]">
              {app.name}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-mono text-white/80 shrink-0">
              {getPlatformIcon()}
              <span>{getPlatformBadge()}</span>
            </span>
          </div>
        </div>

        {/* Center Tabs: App / Telemetry / Details */}
        <div className="hidden md:flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('app')}
            className={`px-3 py-0.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'app'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Application View
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-0.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            OS Telemetry
          </button>
        </div>

        {/* Right Titlebar Controls (ICOS Style with Snap Layouts Menu) */}
        <div className="flex items-center gap-1 relative">
          <button
            onClick={handleOpenExternal}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Open in Native Browser Window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMinimize(windowState.windowId)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={() => onToggleMaximize(windowState.windowId)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => onClose(windowState.windowId)}
            className="p-1.5 rounded-lg hover:bg-rose-500/80 text-white/70 hover:text-white transition-colors cursor-pointer ml-1"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Bar */}
      <div className="h-9 px-4 bg-black/30 border-b border-white/5 flex items-center justify-between text-xs text-white/70 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden flex-1 mr-4">
          <button 
            onClick={handleRefresh}
            className={`p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer ${isRefreshing ? 'animate-spin' : ''}`}
            title="Reload Frame"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 bg-black/40 border border-white/10 px-3 py-0.5 rounded-lg text-[11px] font-mono text-white/80 truncate">
            {iframeUrl}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-white/50 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3 h-3" /> Sandbox Verified
          </span>
          <span>v{app.version}</span>
        </div>
      </div>

      {/* Main Window Body Container */}
      <div className="flex-1 relative overflow-hidden bg-slate-950/80 flex flex-col">
        {activeTab === 'app' && (
          <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
            {/* 1. ICY WEB BROWSER VIEW (Browser app & website shortcuts) */}
            {app.id === 'com.icy.browser' || app.capabilities?.includes('web-shortcut') || (app.launchMethod === 'external-web-url' && !app.id.startsWith('com.icy.')) ? (
              <IcyWebBrowser initialUrl={app.verifiedLaunchTarget} appName={app.name} />
            ) : app.id === 'com.icy.files' || app.capabilities?.includes('folder') ? (
              /* 2. ICY FILE EXPLORER VIEW (Folder shortcuts & file management) */
              <IcyFileExplorer folderName={app.name} />
            ) : app.id === 'com.icy.reader' || app.capabilities?.includes('pdf-document') ? (
              /* 3. ICY PDF STUDIO VIEW (PDF document shortcuts) */
              <IcyPdfStudio documentName={app.name} />
            ) : isAndroid ? (
              /* 4. ANDROID RUNTIME CONTAINER */
              <div className="w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 bg-slate-950">
                <div className="w-full max-w-sm h-full max-h-[640px] rounded-[36px] border-4 border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden relative">
                  {/* Android Top Camera Punch Hole */}
                  <div className="w-full h-7 bg-slate-950 flex items-center justify-between px-6 shrink-0 text-[10px] text-white/70 font-mono">
                    <span>9:41</span>
                    <div className="w-3 h-3 rounded-full bg-slate-800 border border-slate-700" />
                    <span>5G · 100%</span>
                  </div>

                  {/* Android App Frame View */}
                  <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-4">
                      {app.name[0]}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{app.name}</h3>
                    <p className="text-xs text-white/60 mb-4 max-w-xs">{app.description}</p>

                    <div className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-left text-xs space-y-1 mb-6">
                      <div className="flex justify-between text-white/50 font-mono text-[10px]">
                        <span>PACKAGE:</span>
                        <span className="text-emerald-400">{app.id}</span>
                      </div>
                      <div className="flex justify-between text-white/50 font-mono text-[10px]">
                        <span>RUNTIME:</span>
                        <span className="text-white">Android ART Container</span>
                      </div>
                      <div className="flex justify-between text-white/50 font-mono text-[10px]">
                        <span>INTENT TARGET:</span>
                        <span className="text-white truncate max-w-[160px]">{app.verifiedLaunchTarget}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleOpenExternal}
                      className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Launch Native Android App</span>
                    </button>
                  </div>

                  {/* Android Bottom Navigation Bar */}
                  <div className="h-10 bg-slate-950 border-t border-slate-800 flex items-center justify-around text-white/60 shrink-0">
                    <button onClick={handleRefresh} className="p-1 hover:text-white cursor-pointer" title="Back / Refresh">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIframeUrl(app.verifiedLaunchTarget)} className="p-1 hover:text-white cursor-pointer" title="Home">
                      <Home className="w-4 h-4" />
                    </button>
                    <button onClick={() => setActiveTab('logs')} className="p-1 hover:text-white cursor-pointer" title="Process Telemetry">
                      <Menu className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : isIOS ? (
              /* 5. IPHONE / IOS RUNTIME CONTAINER */
              <div className="w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 bg-slate-950">
                <div className="w-full max-w-sm h-full max-h-[640px] rounded-[48px] border-4 border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden relative">
                  {/* Dynamic Island */}
                  <div className="w-full h-10 bg-slate-950 flex items-center justify-between px-7 shrink-0 text-[10px] text-white/80 font-semibold">
                    <span>9:41</span>
                    <div className="w-24 h-5 rounded-full bg-black border border-slate-800" />
                    <span>5G</span>
                  </div>

                  {/* iOS App View */}
                  <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 rounded-[22px] bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-4">
                      {app.name[0]}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{app.name}</h3>
                    <p className="text-xs text-white/60 mb-4 max-w-xs">{app.description}</p>

                    <div className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-left text-xs space-y-1 mb-6">
                      <div className="flex justify-between text-white/50 font-mono text-[10px]">
                        <span>BUNDLE ID:</span>
                        <span className="text-sky-400">{app.id}</span>
                      </div>
                      <div className="flex justify-between text-white/50 font-mono text-[10px]">
                        <span>SCHEME:</span>
                        <span className="text-white truncate max-w-[160px]">{app.verifiedLaunchTarget}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleOpenExternal}
                      className="px-5 py-2.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-lg flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Launch iOS App</span>
                    </button>
                  </div>

                  {/* iOS Bottom Home Bar */}
                  <div className="h-6 bg-slate-950 flex items-center justify-center shrink-0">
                    <div className="w-32 h-1 bg-white/40 rounded-full" />
                  </div>
                </div>
              </div>
            ) : (
              /* 6. STANDARD WEB & DESKTOP CONTAINER (ICY Apps, Desktop, Linux, macOS) */
              <div className="w-full h-full flex flex-col relative overflow-hidden bg-slate-900/90">
                {app.verifiedLaunchTarget.startsWith('http://') || app.verifiedLaunchTarget.startsWith('https://') ? (
                  <iframe
                    src={app.verifiedLaunchTarget}
                    title={app.name}
                    className="w-full h-full border-none bg-white"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-3xl font-bold text-white shadow-2xl mb-4">
                      {app.name[0]}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{app.name}</h3>
                    <p className="text-sm text-white/60 max-w-md mb-6">{app.description}</p>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left font-mono text-xs max-w-md w-full space-y-2 mb-6">
                      <div className="flex justify-between">
                        <span className="text-white/40">App ID:</span>
                        <span className="text-blue-400">{app.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Launch Target:</span>
                        <span className="text-white">{app.verifiedLaunchTarget}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Publisher:</span>
                        <span className="text-white">{app.publisher}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleOpenExternal}
                      className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-xl flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Execute External Protocol</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LOGS / TELEMETRY TAB */}
        {activeTab === 'logs' && (
          <div className="w-full h-full p-6 bg-slate-950 font-mono text-xs text-emerald-400 overflow-y-auto space-y-2">
            <div className="text-white/40 border-b border-white/10 pb-2 flex items-center justify-between">
              <span>ICOS Kernel Process Diagnostic · PID 4820</span>
              <span className="text-emerald-400">● Active</span>
            </div>
            <div>[0.000] Initializing process context for {app.id}...</div>
            <div>[0.012] Sandboxed permissions verified: {app.permissions.join(', ') || 'none'}</div>
            <div>[0.024] Runtime container mounted: {app.runtimeType}</div>
            <div>[0.038] Target protocol verified: {app.verifiedLaunchTarget}</div>
            <div>[0.052] CPU Affinity: Core 0-3 · Memory Allocated: 128 MB</div>
            <div className="text-blue-400">[0.080] Window focus established on ICOS Desktop Shell.</div>
          </div>
        )}
      </div>

      {/* OS Window Footer Bar */}
      <div className="h-7 px-4 bg-black/60 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50 shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3 text-blue-400" />
          <span>ICY Kernel 2026.1 · Active Window</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>ICY AI Operator Bus Connected</span>
        </div>
      </div>
    </motion.div>
    </AnimatePresence>
  );
};
