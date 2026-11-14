import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { themeBootScript } from '@/lib/theme';
import './globals.css';

const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display-face', weight: ['500', '600', '700'] });
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code' });

export const metadata: Metadata = {
  title: 'MyFineDraw',
  description: 'Organize projetos com diagramas ER, fluxogramas, notas e imagens.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${body.variable} ${display.variable} ${code.variable}`}>
      <body>
        <Script id="mfd-theme" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
