import { useTranslation } from 'react-i18next';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex items-center gap-2 mb-6 text-[#37352F]">
        <span className="w-3 h-3 bg-[#37352F]" />
        <span className="w-3 h-3 bg-[#37352F] rounded-full" />
        <span className="font-bold text-lg leading-none">&#10005;</span>
      </div>
      <h1 className="text-3xl font-serif-display font-semibold mb-2">{t('cust.notFound.title', { defaultValue: 'Page not found' })}</h1>
      <p className="text-gray-500 mb-6 max-w-sm">{t('cust.notFound.body', { defaultValue: "The page you're looking for doesn't exist or may have moved." })}</p>
      <a href="/" className="bg-[#37352F] text-white px-6 py-3 rounded-lg font-medium hover:bg-opacity-90 transition">{t('cust.notFound.backHome', { defaultValue: 'Back to home' })}</a>
    </div>
  );
}
