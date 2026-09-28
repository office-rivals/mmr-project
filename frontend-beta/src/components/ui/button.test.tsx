import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('keeps legacy asChild links semantic while composing styles', () => {
    const markup = renderToStaticMarkup(
      <Button asChild variant="outline" className="extra-class">
        <a href="/settings">Settings</a>
      </Button>
    );

    expect(markup).toContain('<a');
    expect(markup).toContain('href="/settings"');
    expect(markup).toContain('extra-class');
    expect(markup).not.toContain('role="button"');
  });
});
