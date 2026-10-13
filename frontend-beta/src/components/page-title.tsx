import type { ReactNode } from 'react';

interface PageTitleProps {
  children?: ReactNode;
  srOnly?: boolean;
}

export function PageTitle({ children, srOnly = false }: PageTitleProps) {
  return (
    <h1
      className={
        srOnly ? 'sr-only' : 'text-3xl font-bold tracking-tight lg:text-4xl'
      }
    >
      {children}
    </h1>
  );
}
