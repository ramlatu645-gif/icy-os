/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { calculateBackoffDelayMs } from '../../security/passwordVerifier';
import { WallpaperBackground } from '../common/WallpaperBackground';

interface PasswordUnlockScreenProps {
  displaySizeScale: number;
  wallpaper?: string;
  onVerifyPassword: (password: string) => Promise<boolean>;
  onUnlocked: () => void;
  onBackToLockScreen: () => void;
}

/**
 * Dedicated, simple, full-screen password-entry page.
 * Includes:
 * - Heading: "Unlock IC App Launcher"
 * - Password input
 * - Show/hide password control
 * - "Unlock" button
 * - Accessible error message for incorrect passwords
 * - Keyboard Enter action to submit
 * - "Back" button to return to the lock screen without unlocking
 */
export const PasswordUnlockScreen: React.FC<PasswordUnlockScreenProps> = ({
  displaySizeScale,
  wallpaper = '',
  onVerifyPassword,
  onUnlocked,
  onBackToLockScreen,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldownRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownRemainingSec]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (cooldownRemainingSec > 0 || isVerifying) {
      return;
    }

    if (!password || password.length === 0) {
      setErrorMessage('Please enter your launcher password.');
      inputRef.current?.focus();
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const valid = await onVerifyPassword(password);
      if (valid) {
        setPassword('');
        setFailedAttempts(0);
        setCooldownRemainingSec(0);
        onUnlocked();
        return;
      }

      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      const backoffMs = calculateBackoffDelayMs(nextFailed);

      if (backoffMs > 0) {
        const waitSec = Math.ceil(backoffMs / 1000);
        setCooldownRemainingSec(waitSec);
        setErrorMessage(
          `Incorrect password. Please wait ${waitSec} seconds before trying again.`
        );
      } else {
        setErrorMessage('Incorrect password. Please try again.');
      }

      inputRef.current?.focus();
      inputRef.current?.select();
    } catch {
      setErrorMessage('Unable to verify password. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const isDisabled = isVerifying || cooldownRemainingSec > 0;

  return (
    <WallpaperBackground wallpaper={wallpaper} blur={true}>
      <main
        style={{
          padding: `${Math.round(24 * displaySizeScale)}px`,
        }}
        className="min-h-dvh w-full flex flex-col items-center justify-center"
      >
        <div
          style={{
            gap: `${Math.round(24 * displaySizeScale)}px`,
          }}
          className="w-full max-w-md flex flex-col items-center text-center"
        >
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-[var(--icy-text-primary)]">
              Unlock ICOS
            </h1>
            <p className="text-base text-[var(--icy-text-secondary)]">
              Enter your password to continue.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="w-full flex flex-col gap-4 mt-2"
          >
            <div className="relative w-full flex items-center">
              <label htmlFor="ic-launcher-unlock-password" className="sr-only">
                Launcher password
              </label>
              <input
                ref={inputRef}
                id="ic-launcher-unlock-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage && cooldownRemainingSec === 0) {
                    setErrorMessage(null);
                  }
                }}
                disabled={isDisabled}
                placeholder="Enter password"
                autoComplete="current-password"
                aria-invalid={errorMessage ? 'true' : 'false'}
                aria-describedby={errorMessage ? 'ic-launcher-unlock-error' : undefined}
                className="w-full min-h-[52px] pl-5 pr-12 py-3 rounded-full bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-[var(--icy-text-primary)] placeholder:text-[var(--icy-text-muted)] text-base focus:outline-none focus:border-[var(--icy-border-focus)] focus:ring-2 focus:ring-[var(--icy-border-focus)]/20 disabled:opacity-60 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--icy-text-muted)] hover:text-[var(--icy-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Eye className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>

            {errorMessage ? (
              <div
                id="ic-launcher-unlock-error"
                role="alert"
                aria-live="assertive"
                className="w-full px-4 py-2.5 rounded-2xl border border-[var(--icy-danger-border)] bg-[var(--icy-danger-bg)] text-[var(--icy-danger-text)] text-sm text-center"
              >
                {errorMessage}
                {cooldownRemainingSec > 0 ? (
                  <span className="ml-1 tabular-clock font-medium">
                    ({cooldownRemainingSec}s)
                  </span>
                ) : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isDisabled}
              className="w-full min-h-[52px] px-6 py-3 rounded-full bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] font-medium text-base shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--icy-border-focus)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {cooldownRemainingSec > 0
                ? `Wait ${cooldownRemainingSec}s`
                : isVerifying
                ? 'Verifying...'
                : 'Unlock'}
            </button>
          </form>

          <button
            type="button"
            onClick={onBackToLockScreen}
            className="min-h-[44px] px-5 py-2 rounded-full text-sm sm:text-base text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Back
          </button>
        </div>
      </main>
    </WallpaperBackground>
  );
};
