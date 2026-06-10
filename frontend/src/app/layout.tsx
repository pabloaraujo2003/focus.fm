import type { Metadata } from 'next';
import { Martian_Mono, Sora, Unbounded } from 'next/font/google';
import './globals.css';

// Três vozes tipográficas: Unbounded (marca/estados, geométrica e cheia
// de personalidade), Martian Mono (dígitos do timer, leitura à distância),
// Sora (texto corrido). Expostas como CSS variables para o globals.css.
const display = Unbounded({ subsets: ['latin'], weight: ['500', '700'], variable: '--fonte-display' });
const mono = Martian_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--fonte-mono' });
const corpo = Sora({ subsets: ['latin'], weight: ['400', '600'], variable: '--fonte-corpo' });

export const metadata: Metadata = {
  title: 'Pomodoro Musical',
  description: 'Timer pomodoro com playlists do Spotify',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${mono.variable} ${corpo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
