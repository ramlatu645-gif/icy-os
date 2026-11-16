/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Folder, 
  FileText, 
  FileCode, 
  Image, 
  Film, 
  Music, 
  Plus, 
  Search, 
  Upload, 
  ChevronRight, 
  FolderPlus, 
  HardDrive, 
  Cloud, 
  Star, 
  Trash2, 
  MoreVertical 
} from 'lucide-react';

export interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'pdf' | 'document' | 'image' | 'code';
  size?: string;
  updatedAt: string;
}

export interface IcyFileExplorerProps {
  folderName?: string;
}

export const IcyFileExplorer: React.FC<IcyFileExplorerProps> = ({ 
  folderName = 'Desktop Folder' 
}) => {
  const [items, setItems] = useState<FileItem[]>([
    { id: '1', name: 'Project Notes.txt', type: 'document', size: '12 KB', updatedAt: 'Today, 2:15 PM' },
    { id: '2', name: 'System Specification.pdf', type: 'pdf', size: '2.4 MB', updatedAt: 'Yesterday' },
    { id: '3', name: 'UI Assets', type: 'folder', updatedAt: '3 days ago' },
    { id: '4', name: 'AppConfig.json', type: 'code', size: '4 KB', updatedAt: '1 week ago' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [activeDrive, setActiveDrive] = useState<'folder' | 'disk' | 'cloud' | 'starred' | 'documents'>('folder');

  const handleCreateFolder = () => {
    const newFolder: FileItem = {
      id: `folder_${Date.now()}`,
      name: `New Folder ${items.filter((i) => i.type === 'folder').length + 1}`,
      type: 'folder',
      updatedAt: 'Just now',
    };
    setItems((prev) => [...prev, newFolder]);
  };

  const handleCreatePdf = () => {
    const newPdf: FileItem = {
      id: `pdf_${Date.now()}`,
      name: `New Document ${items.filter((i) => i.type === 'pdf').length + 1}.pdf`,
      type: 'pdf',
      size: '1.2 MB',
      updatedAt: 'Just now',
    };
    setItems((prev) => [...prev, newPdf]);
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeDrive === 'starred') return item.type === 'pdf' || item.type === 'document';
    if (activeDrive === 'documents') return item.type === 'document' || item.type === 'pdf';
    return true;
  });

  const getItemIcon = (type: FileItem['type']) => {
    switch (type) {
      case 'folder':
        return <Folder className="w-8 h-8 text-blue-400" />;
      case 'pdf':
        return <FileText className="w-8 h-8 text-rose-400" />;
      case 'code':
        return <FileCode className="w-8 h-8 text-amber-400" />;
      case 'image':
        return <Image className="w-8 h-8 text-emerald-400" />;
      default:
        return <FileText className="w-8 h-8 text-sky-400" />;
    }
  };

  return (
    <div className="w-full h-full flex bg-[#0c0e18] text-white font-sans select-none overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-48 bg-[#080911] border-r border-white/10 p-3 flex flex-col gap-4 shrink-0 text-xs font-medium">
        <div>
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 font-mono">
            Storage Locations
          </div>
          <div className="space-y-1">
            <button 
              onClick={() => setActiveDrive('folder')}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer transition-colors ${
                activeDrive === 'folder' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-white/10 text-white/70'
              }`}
            >
              <Folder className="w-4 h-4 text-blue-400" />
              <span className="truncate">{folderName}</span>
            </button>
            <button 
              onClick={() => setActiveDrive('disk')}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer transition-colors ${
                activeDrive === 'disk' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-white/10 text-white/70'
              }`}
            >
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Local Disk (C:)</span>
            </button>
            <button 
              onClick={() => setActiveDrive('cloud')}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer transition-colors ${
                activeDrive === 'cloud' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-white/10 text-white/70'
              }`}
            >
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span>ICY Cloud Storage</span>
            </button>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 font-mono">
            Quick Access
          </div>
          <div className="space-y-1">
            <button 
              onClick={() => setActiveDrive('starred')}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer transition-colors ${
                activeDrive === 'starred' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-white/10 text-white/70'
              }`}
            >
              <Star className="w-4 h-4 text-amber-400" />
              <span>Starred Files</span>
            </button>
            <button 
              onClick={() => setActiveDrive('documents')}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer transition-colors ${
                activeDrive === 'documents' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-white/10 text-white/70'
              }`}
            >
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Documents</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main File Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between gap-3 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateFolder}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow cursor-pointer transition-all"
            >
              <FolderPlus className="w-4 h-4" />
              <span>New Folder</span>
            </button>
            <button
              onClick={handleCreatePdf}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FileText className="w-4 h-4 text-rose-400" />
              <span>New PDF</span>
            </button>
          </div>

          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-white/40 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="pl-9 pr-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400 w-48"
            />
          </div>
        </div>

        {/* Path Breadcrumb Bar */}
        <div className="h-8 px-4 bg-black/40 border-b border-white/5 flex items-center text-xs text-white/60 font-mono">
          <span>ICOS</span>
          <ChevronRight className="w-3 h-3 mx-1 text-white/30" />
          <span>Desktop</span>
          <ChevronRight className="w-3 h-3 mx-1 text-white/30" />
          <span className="text-blue-400 font-semibold">{folderName}</span>
        </div>

        {/* Grid View */}
        <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const isSelected = selectedItemId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center relative group ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-400/60 shadow-lg'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="mb-2">{getItemIcon(item.type)}</div>
                  <span className="text-xs font-medium text-white truncate max-w-full">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-white/40 mt-1">{item.size || 'Folder'}</span>

                  <button
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/80 text-white/60 hover:text-white transition-all cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-16 text-white/40 text-sm">
              This folder is empty. Click &ldquo;New Folder&rdquo; or &ldquo;New PDF&rdquo; to add items.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
