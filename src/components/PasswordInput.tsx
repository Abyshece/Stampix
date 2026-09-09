import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Password input with a click-to-reveal eye icon, matching common
 * browser-builtin UX. Used everywhere a password is typed.
 *
 * Defaults to type="password"; tapping the eye toggles to type="text".
 * The toggle is a button inside the input's padding-right area; the
 * input handles all other styling via the className prop so existing
 * forms can pass their styling without us prescribing it.
 */
export function PasswordInput({
  value,
  onChange,
  placeholder = 'Password',
  className = '',
  autoComplete = 'current-password',
  disabled = false,
  onKeyDown,
  required,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  required?: boolean;
  id?: string;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        onKeyDown={onKeyDown}
        required={required}
        // Right-pad to leave room for the eye button (~36px).
        className={`pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        tabIndex={-1}
        aria-label={visible ? t('form.password.hide', { defaultValue: 'Hide password' }) : t('form.password.show', { defaultValue: 'Show password' })}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#37352F] p-1 transition"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
