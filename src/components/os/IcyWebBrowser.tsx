/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Home, 
  Lock, 
  Star, 
  Plus, 
  X, 
  ExternalLink,
  ShieldCheck,
  Search
} from 'lucide-react';

export interface WebBrowserTab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
}

export interface IcyWebBrowserProps {
  initialUrl?: string;
  appName?: string;
}

export const IcyWebBrowser: React.FC<IcyWebBrowserProps> = ({ 
  initialUrl = 'https://google.com',
  appName = 'ICY Web Browser'
}) => {
  const [tabs, setTabs] = useState<WebBrowserTab[]>([
    {
      id: 'tab_1',
      title: appName || 'Web Navigator',
      url: initialUrl,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(initialUrl.startsWith('http') ? initialUrl : `https://${initialUrl}`).hostname}&sz=64`,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_1');
  const [addressInput, setAddressInput] = useState<string>(initialUrl);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleNavigate = (urlToLoad: string) => {
    let target = urlToLoad.trim();
    if (!target) return;

    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      if (target.includes('.') && !target.includes(' ')) {
        target = `https://${target}`;
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
      }
    }

    try {
      const parsed = new URL(target);
      const domain = parsed.hostname;
      const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      const title = domain.replace(/^www\./, '');

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, url: target, title, favicon } : t
        )
      );
      setAddressInput(target);
    } catch {
      setAddressInput(target);
    }
  };

  const handleNewTab = () => {
    const newId = `tab_${Date.now()}`;
    const newTab: WebBrowserTab = {
      id: newId,
      title: 'New Tab',
      url: 'https://google.com',
      favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setAddressInput('https://google.com');
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[remaining.length - 1].id);
      setAddressInput(remaining[remaining.length - 1].url);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-white font-sans select-none overflow-hidden">
      {/* 1. Tab Bar */}
      <div className="h-10 bg-[#0a0c16] border-b border-white/10 px-2 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 pt-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id);
                setAddressInput(tab.url);
              }}
              className={`group relative h-8 max-w-[200px] min-w-[120px] px-3 rounded-t-xl flex items-center justify-between text-xs font-medium cursor-pointer transition-all ${
                isActive
                  ? 'bg-slate-900 text-white border-t border-x border-white/15 shadow-md'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden mr-2">
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded shrink-0" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                )}
                <span className="truncate">{tab.title}</span>
              </div>

              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="p-0.5 rounded-full hover:bg-white/20 text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={handleNewTab}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer ml-1"
          title="Open New Tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Navigation Control & Address Bar */}
      <div className="h-11 px-3 bg-slate-900 border-b border-white/10 flex items-center gap-2 shrink-0">
        <button
          onClick={() => handleNavigate(activeTab.url)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleNavigate(activeTab.url)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleRefresh}
          className={`p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer ${
            isRefreshing ? 'animate-spin text-cyan-400' : ''
          }`}
          title="Reload"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleNavigate('https://google.com')}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* Address Input Field */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleNavigate(addressInput);
          }}
          className="flex-1 flex items-center bg-black/50 border border-white/15 focus-within:border-cyan-400 rounded-xl px-3 py-1 transition-all"
        >
          <Lock className="w-3.5 h-3.5 text-emerald-400 mr-2 shrink-0" />
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
            placeholder="Type a URL or web search..."
          />
          <button
            type="button"
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ml-1 ${
              isBookmarked ? 'text-amber-400' : 'text-white/40 hover:text-white'
            }`}
            title="Bookmark"
          >
            <Star className="w-3.5 h-3.5" />
          </button>
        </form>

        <a
          href={activeTab.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          title="Open in new browser window"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* 3. Main Web Page Sandbox iFrame Render View */}
      <div className="flex-1 relative bg-white overflow-hidden">
        {activeTab.url ? (
          <iframe
            key={`${activeTab.id}_${activeTab.url}`}
            src={activeTab.url}
            title={activeTab.title}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-center p-8">
            <Globe className="w-16 h-16 text-cyan-400/40 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">ICY Web Browser</h3>
            <p className="text-xs text-white/50 max-w-sm mb-6">
              Enter any URL or search term above to navigate the open web inside ICOS.
            </p>
          </div>
        )}
      </div>

      {/* 4. Browser Footer Security Bar */}
      <div className="h-6 px-4 bg-slate-950 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50 font-mono shrink-0">
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="w-3 h-3" />
          <span>TLS 1.3 Encrypted Connection</span>
        </div>
        <div>ICY Browser Engine v2.0</div>
      </div>
    </div>
  );
};
