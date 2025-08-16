export const metadata = {
  title: 'Agency OS',
  description: 'Mind Map Operacional e Escala',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
  </html>
  );
}
