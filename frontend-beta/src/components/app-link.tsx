import type { AnchorHTMLAttributes, ComponentType, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

export interface AppLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  to: string;
  /** Use `search` for query parameters; `to` contains only the pathname. */
  search?: Record<string, unknown> | true;
  replace?: boolean;
  children?: ReactNode;
}

// Runtime-built paths cannot satisfy the router's literal route union.
export const AppLink = Link as unknown as ComponentType<AppLinkProps>;
