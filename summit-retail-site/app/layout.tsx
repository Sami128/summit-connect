import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Summit Connect | Your updates',
  description: 'Store updates, announcements, and confirmations for Summit Retail Group.',
  applicationName: 'Summit Connect',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#087f69' };

// Apply a saved choice (or the device preference) before the first paint.
const initializeTheme = `(function(){var s;try{s=localStorage.getItem('summit-theme')}catch(e){}var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: initializeTheme }} /></head><body>{children}</body></html>;
}
