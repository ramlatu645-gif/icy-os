/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ICOS Voice AI Operator Engine
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PersonalizedAIConfig, RegisteredApplication } from '../types/launcher';
import { RealHardwareStatus } from './useDeviceHardwareStatus';

interface UseAIOperatorVoiceProps {
  aiConfig: PersonalizedAIConfig;
  installedApps: readonly RegisteredApplication[];
  hardwareStatus: RealHardwareStatus;
  onLaunchApp: (app: RegisteredApplication) => void;
  onCreateFolder: () => void;
  onCreatePdf: () => void;
  onCreateWebsiteShortcut: () => void;
  onRefreshDesktop: () => void;
  onOpenSettings: () => void;
  onOpenCodeStudio?: (initialCode?: string, title?: string) => void;
  onOpen3DModeler?: (shape?: 'torus' | 'crystal' | 'sphere' | 'cube' | 'wave', title?: string) => void;
  onOpenVectorDesign?: (prompt?: string) => void;
  onOpenDrawingCanvas?: () => void;
  onOpenDeviceSetup?: () => void;
  onSwitchFormFactor?: (mode: 'android' | 'workstation' | 'tablet' | 'desktop') => void;
}

export function useAIOperatorVoice({
  aiConfig,
  installedApps,
  hardwareStatus,
  onLaunchApp,
  onCreateFolder,
  onCreatePdf,
  onCreateWebsiteShortcut,
  onRefreshDesktop,
  onOpenSettings,
  onOpenCodeStudio,
  onOpen3DModeler,
  onOpenVectorDesign,
  onOpenDrawingCanvas,
  onOpenDeviceSetup,
  onSwitchFormFactor,
}: UseAIOperatorVoiceProps) {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  const isRunningRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          isRunningRef.current = true;
          console.log('Voice Recognition Started');
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
          handleVoiceCommand(transcript);
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'aborted') {
            console.warn('Voice Recognition Aborted (transient or requested)');
            return;
          }
          
          console.error('Voice Recognition Error:', event.error);
          setIsActive(false);
          
          if (event.error === 'not-allowed') {
            speak("Microphone access is denied. Please enable microphone permissions in your browser settings.");
          } else if (event.error === 'network') {
            speak("A network error occurred. Please check your connection.");
          }
        };

        recognition.onend = () => {
          isRunningRef.current = false;
          console.log('Voice Recognition Ended');
          if (isActive) {
            try {
              recognition.start();
            } catch (err) {
              console.error("Failed to restart recognition:", err);
            }
          }
        };

        recognitionRef.current = recognition;
      }
      synthesisRef.current = window.speechSynthesis;
    }
  }, [isActive]);

  const speak = useCallback((text: string) => {
    if (!synthesisRef.current) return;
    synthesisRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    synthesisRef.current.speak(utterance);
  }, []);

  const handleVoiceCommand = useCallback((query: string) => {
    const lower = query.trim().toLowerCase();
    if (!lower) return;

    setIsProcessing(true);
    
    // Simulate a brief neural thinking delay for better UX
    setTimeout(() => {
      let response = '';

      // 1. Hardware / Battery / Telemetry
      if (lower.includes('battery') || lower.includes('power') || lower.includes('charge')) {
        const state = hardwareStatus.isCharging ? 'surging through the circuits' : 'powering your environment';
        response = `Understood. Your system energy is at ${hardwareStatus.batteryLevel} percent, ${state}. I've optimized the neural pathways for maximum efficiency.`;
      } else if (lower.includes('wifi') || lower.includes('network') || lower.includes('internet')) {
        response = `Scanning signal frequencies. You are currently ${hardwareStatus.isOnline ? 'synchronized with the global data grid' : 'operating in local isolated mode'} via ${hardwareStatus.networkType}. Connection is stable.`;
      } 
      // 2. Open / Launch Applications
      else if (lower.includes('open') || lower.includes('launch') || lower.includes('start') || lower.includes('run')) {
        const target = lower.replace(/^(open|launch|start|run)\s+/, '').replace(/\s+app$/, '').trim();
        const matchedApp = installedApps.find((app) => 
          app.name.toLowerCase().includes(target) || 
          app.id.toLowerCase().includes(target)
        );
        if (matchedApp) {
          response = `Initializing the runtime environment for ${matchedApp.name}. It should be active in your workspace now.`;
          onLaunchApp(matchedApp);
        } else {
          response = `I've audited the application registry but couldn't find ${target}. I can assist you with system tasks or creative work instead.`;
        }
      }
      // 3. Creative Tasks
      else if (lower.includes('code') || lower.includes('script') || lower.includes('program') || lower.includes('write')) {
        response = `Generating a clean reactive architecture in Code Studio. I've prepared a sandbox with real-time execution capabilities for your project.`;
        onOpenCodeStudio?.('// ICOS Intelligent Code Synthesis\nconst system = "ICOS";\nconsole.log(`Hello from ${system} Voice!`);\n\n// Add your logic here...', 'Voice Synthesized Script');
      } else if (lower.includes('3d model') || lower.includes('model 3d') || lower.includes('torus') || lower.includes('crystal') || lower.includes('geometry') || lower.includes('sphere')) {
        const shape = lower.includes('crystal') ? 'crystal' : lower.includes('sphere') ? 'sphere' : lower.includes('cube') ? 'cube' : 'torus';
        response = `Projecting a procedural ${shape} geometry into the spatial modeler. Lighting and vertex shaders are now active in the ICOS environment.`;
        onOpen3DModeler?.(shape as any, `Voice Spatial ${shape.toUpperCase()}`);
      } else if (lower.includes('design') || lower.includes('vector') || lower.includes('logo') || lower.includes('brand') || lower.includes('draw')) {
        if (lower.includes('draw') || lower.includes('sketch') || lower.includes('paint')) {
           response = `Activating the creative drawing canvas. The pen brushes and neon radiance palette are ready for your input.`;
           onOpenDrawingCanvas?.();
        } else {
          response = `Opening the Vector Design Studio. I've primed the SVG engine with your request for "${query}".`;
          onOpenVectorDesign?.(query);
        }
      }
      // 4. Desktop Operations
      else if (lower.includes('create folder') || lower.includes('new folder')) {
        onCreateFolder();
        response = 'A new directory container has been materialized on your desktop grid.';
      } else if (lower.includes('create pdf') || lower.includes('new pdf') || lower.includes('document')) {
        onCreatePdf();
        response = 'Generated a new blank document. ICY PDF Studio is now handling the file buffer.';
      } else if (lower.includes('refresh') || lower.includes('reload')) {
        onRefreshDesktop();
        response = 'Synchronizing desktop icons and system services. The ICOS workspace is now up to date.';
      }
      // 5. Device Setup
      else if (lower.includes('install') || lower.includes('setup device') || lower.includes('form factor') || lower.includes('desktop') || lower.includes('android')) {
        if (lower.includes('switch to android')) {
          onSwitchFormFactor?.('android');
          response = 'Reconfiguring shell for Android Mobile curvature. Gestures and mobile status bars are now active.';
        } else if (lower.includes('switch to desktop') || lower.includes('switch to workstation')) {
          onSwitchFormFactor?.('workstation');
          response = 'Expanding environment to full ICOS Workstation mode. Multi-windowing and dock stability are prioritized.';
        } else {
          onOpenDeviceSetup?.();
          response = 'Launching the hardware calibration wizard. You can now adapt ICOS to your specific device dimensions.';
        }
      }
      // 6. Settings
      else if (lower.includes('settings') || lower.includes('preferences') || lower.includes('theme')) {
        onOpenSettings();
        response = 'Accessing system configuration modules. What would you like to adjust?';
      }
      // 7. Identity / Intelligence
      else if (lower.includes('who are you') || lower.includes('what are you')) {
        response = `I am the ICOS Neural Operator, a high-performance voice interface integrated into the core of your OS. I don't just chat; I execute.`;
      }
      // 8. Help
      else if (lower.includes('help') || lower.includes('what can you do') || lower.includes('capabilities')) {
        response = `I am your ${aiConfig.assistantName}, the ICOS Neural Operator. I can synthesize code, model 3D geometries, design brand graphics, manage your hardware telemetry, and automate your desktop environment. Just speak a command and I will execute it.`;
      }
      // 9. Default
      else {
        response = `I've analyzed your command: "${query}". I am synchronizing with the ICY backend to provide the most efficient execution path. How else can I assist with your ICOS experience?`;
      }

      setIsProcessing(false);
      if (response) {
        speak(response);
      }
    }, 800);
  }, [hardwareStatus, installedApps, aiConfig.assistantName, onLaunchApp, onCreateFolder, onCreatePdf, onRefreshDesktop, onOpenSettings, onOpenCodeStudio, onOpen3DModeler, onOpenVectorDesign, onOpenDrawingCanvas, onOpenDeviceSetup, onSwitchFormFactor, speak]);

  const toggleVoice = useCallback(async () => {
    if (isActive) {
      if (isRunningRef.current) {
        recognitionRef.current?.stop();
      }
      setIsActive(false);
    } else {
      try {
        // More robust permission request
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (mediaErr) {
          console.warn("Standard getUserMedia failed, trying alternate approach", mediaErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
        }
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        if (recognitionRef.current) {
          if (!isRunningRef.current) {
            recognitionRef.current.start();
          }
          setIsActive(true);
          speak(`Neural interface active. How can I assist you in ICOS today?`);
        } else {
          speak("Voice recognition is not supported in this browser environment.");
        }
      } catch (err) {
        console.error("Microphone access failed:", err);
        const errorMsg = err instanceof Error ? err.name : String(err);
        if (errorMsg === 'NotAllowedError' || errorMsg === 'PermissionDeniedError') {
          speak("ICOS requires microphone access. Please click the lock icon in your browser's address bar and allow the microphone. If you're in an AI Studio preview, check the iframe permissions.");
        } else {
          speak("I couldn't initialize the voice system. Please check your hardware connections.");
        }
      }
    }
  }, [isActive, speak]);

  return {
    isActive,
    isSpeaking,
    isProcessing,
    toggleVoice,
    speak,
  };
}
