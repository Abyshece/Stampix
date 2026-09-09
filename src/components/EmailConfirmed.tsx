import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmailConfirmedProps {
  onContinue: () => void;
}

/**
 * Shown after a merchant clicks the email-confirmation link. The link
 * itself logs them in via Supabase, but per the chosen UX we present an
 * explicit success screen and have them sign in deliberately (onContinue
 * signs them out and routes to the login form).
 */
export function EmailConfirmed({ onContinue }: EmailConfirmedProps) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 text-[#37352F]">
      <div className="max-w-sm w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-16 h-16 bg-green-50 rounded-full mx-auto flex items-center justify-center text-green-600 border border-green-100">
          <CheckCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-serif-display font-semibold">{t('cust.emailConfirmed.title', { defaultValue: 'Email confirmed' })}</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {t('cust.emailConfirmed.body', { defaultValue: 'Your email address has been verified. Sign in to set up your workspace and start creating loyalty cards.' })}
          </p>
        </div>
        <button
          onClick={onContinue}
          className="w-full bg-[#37352F] text-white py-3 rounded-md font-medium hover:bg-opacity-90 transition shadow-sm"
        >
          {t('cust.emailConfirmed.signIn', { defaultValue: 'Sign in' })}
        </button>
      </div>
    </div>
  );
}
