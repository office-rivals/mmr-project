import type { ReactNode } from 'react';

interface PageTitleProps {
  children?: ReactNode;
  /**
   * Render the heading visually hidden but still in the document outline /
   * exposed to assistive tech — for pages whose visible title lives elsewhere.
   */
  srOnly?: boolean;
}

export function PageTitle({ children, srOnly = false }: PageTitleProps) {
  return (
    <h1
      className={
        srOnly ? 'sr-only' : 'text-center text-4xl font-extrabold md:text-6xl'
      }
    >
      {children}
    </h1>
  );
}
