import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, ChevronsDown, ChevronsUp, ChevronsUpDown } from 'lucide-react';
import type { SeasonResponse } from '@/api-v3/models';
import { useHydrated } from '@/hooks/use-hydrated';

export interface SeasonPickerProps {
  seasons: SeasonResponse[];
  currentSeason: SeasonResponse;
  selectedSeasonId?: string;
  onSeasonChange: (season: SeasonResponse) => void;
}

// Adapted from Bits UI to preserve the reference picker's typeahead behavior.
function wrapArray<T>(values: T[], startIndex: number): T[] {
  return values.map((_, index) => values[(startIndex + index) % values.length]);
}

function getNextMatch(
  values: string[],
  search: string,
  currentMatch: string
): string | undefined {
  const lowerSearch = search.toLowerCase();
  if (lowerSearch.endsWith(' ')) {
    const withoutSpace = lowerSearch.slice(0, -1);
    const matches = values.filter((value) =>
      value.toLowerCase().startsWith(withoutSpace)
    );
    if (matches.length <= 1) {
      return getNextMatch(values, withoutSpace, currentMatch);
    }

    const current = currentMatch.toLowerCase();
    if (
      current.startsWith(withoutSpace) &&
      current.charAt(withoutSpace.length) === ' ' &&
      search.trim() === withoutSpace
    ) {
      return currentMatch;
    }

    const spacedMatches = values.filter((value) =>
      value.toLowerCase().startsWith(lowerSearch)
    );
    if (spacedMatches.length > 0) {
      const currentIndex = values.indexOf(currentMatch);
      return (
        wrapArray(spacedMatches, Math.max(currentIndex, 0)).find(
          (match) => match !== currentMatch
        ) ?? currentMatch
      );
    }
  }

  const repeated =
    search.length > 1 &&
    [...search].every((character) => character === search[0]);
  const normalizedSearch = repeated ? search[0] : search;
  const currentIndex = values.indexOf(currentMatch);
  let wrappedValues = wrapArray(values, Math.max(currentIndex, 0));
  if (normalizedSearch.length === 1) {
    wrappedValues = wrappedValues.filter((value) => value !== currentMatch);
  }
  return wrappedValues.find((value) =>
    value.toLowerCase().startsWith(normalizedSearch.toLowerCase())
  );
}

export function SeasonPicker({
  seasons,
  currentSeason,
  selectedSeasonId,
  onSeasonChange,
}: SeasonPickerProps) {
  const hydrated = useHydrated();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [popupOffset, setPopupOffset] = useState(0);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const popupOffsetRef = useRef(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typeaheadRef = useRef('');
  const typeaheadTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const selectedSeason =
    (selectedSeasonId
      ? seasons.find((s) => s.id === selectedSeasonId)
      : undefined) ?? currentSeason;

  // The API returns seasons newest-first, while labels count from the oldest.
  const seasonNumbers = useMemo(
    () =>
      new Map(
        seasons.map((season, index) => [season.id, seasons.length - index])
      ),
    [seasons]
  );

  const seasonLabel = (season: SeasonResponse): string =>
    season.id === currentSeason.id
      ? 'Current Season'
      : `Season ${seasonNumbers.get(season.id) ?? '?'}`;

  const resetTypeahead = () => {
    typeaheadRef.current = '';
    clearTimeout(typeaheadTimeoutRef.current);
  };

  useEffect(() => () => clearTimeout(typeaheadTimeoutRef.current), []);

  const updateScrollControls = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const paddingTop = Number.parseInt(
      getComputedStyle(viewport).paddingTop,
      10
    );
    const maxScroll = viewport.scrollHeight - viewport.clientHeight;
    setCanScrollUp(viewport.scrollTop - paddingTop > 0.1);
    setCanScrollDown(Math.ceil(viewport.scrollTop) < maxScroll - paddingTop);
  }, []);

  const stopAutoScroll = useCallback(() => {
    clearTimeout(autoScrollTimeoutRef.current);
    autoScrollTimeoutRef.current = undefined;
  }, []);

  const startAutoScroll = useCallback(
    (direction: -1 | 1) => {
      if (autoScrollTimeoutRef.current !== undefined) return;
      const tick = () => {
        const viewport = viewportRef.current;
        if (!viewport) {
          stopAutoScroll();
          return;
        }
        const previous = viewport.scrollTop;
        viewport.scrollTop += direction * 40;
        updateScrollControls();
        if (viewport.scrollTop === previous) {
          stopAutoScroll();
          return;
        }
        autoScrollTimeoutRef.current = setTimeout(tick, 50);
      };
      autoScrollTimeoutRef.current = setTimeout(tick, 50);
    },
    [stopAutoScroll, updateScrollControls]
  );

  useEffect(() => {
    if (!open) return;

    const alignPopup = () => {
      const popup = popupRef.current;
      if (!popup) return;

      const unshiftedLeft =
        popup.getBoundingClientRect().left - popupOffsetRef.current;
      const scale = window.devicePixelRatio || 1;
      const offset = Math.round(unshiftedLeft * scale) / scale - unshiftedLeft;
      popupOffsetRef.current = offset;
      setPopupOffset(offset);
    };

    requestAnimationFrame(alignPopup);

    const resizeObserver = new ResizeObserver(alignPopup);
    if (rootRef.current) resizeObserver.observe(rootRef.current);
    window.addEventListener('resize', alignPopup);

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        resetTypeahead();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      resizeObserver.disconnect();
      window.removeEventListener('resize', alignPopup);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    requestAnimationFrame(updateScrollControls);
  }, [highlightedIndex, open, updateScrollControls]);

  useEffect(() => {
    if (!open) {
      stopAutoScroll();
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) return;
    const frame = requestAnimationFrame(updateScrollControls);
    const resizeObserver = new ResizeObserver(updateScrollControls);
    resizeObserver.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      stopAutoScroll();
    };
  }, [open, seasons.length, stopAutoScroll, updateScrollControls]);

  const openAt = (index: number) => {
    if (seasons.length === 0) return;
    if (!open) resetTypeahead();
    popupOffsetRef.current = 0;
    setPopupOffset(0);
    setHighlightedIndex(Math.max(0, Math.min(index, seasons.length - 1)));
    setOpen(true);
  };

  const selectedIndex = Math.max(
    0,
    seasons.findIndex((season) => season.id === selectedSeason.id)
  );

  const moveHighlight = (offset: number) => {
    setHighlightedIndex((index) =>
      Math.max(0, Math.min(index + offset, seasons.length - 1))
    );
  };

  const select = (season: SeasonResponse) => {
    resetTypeahead();
    setOpen(false);
    triggerRef.current?.focus();
    onSeasonChange(season);
  };

  const runTypeahead = (key: string, currentIndex: number) => {
    typeaheadRef.current += key;
    clearTimeout(typeaheadTimeoutRef.current);
    typeaheadTimeoutRef.current = setTimeout(() => {
      typeaheadRef.current = '';
    }, 1000);

    const values = seasons.map(seasonLabel);
    const match = getNextMatch(
      values,
      typeaheadRef.current,
      values[currentIndex] ?? ''
    );
    const matchIndex = match === undefined ? -1 : values.indexOf(match);
    if (matchIndex < 0) return false;

    if (open) {
      setHighlightedIndex(matchIndex);
    } else {
      onSeasonChange(seasons[matchIndex]);
    }
    return true;
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Select a season"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={
          open ? `${id}-season-${highlightedIndex}` : undefined
        }
        disabled={!hydrated}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openAt(selectedIndex);
          }
        }}
        onKeyDown={(event) => {
          if (!open) {
            if (
              event.key === 'Enter' ||
              event.key === ' ' ||
              event.key === 'ArrowDown' ||
              event.key === 'ArrowUp'
            ) {
              event.preventDefault();
              openAt(selectedIndex);
            } else if (
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.altKey &&
              !event.metaKey
            ) {
              runTypeahead(event.key, selectedIndex);
            }
            return;
          }

          if (event.key === 'Tab') {
            resetTypeahead();
            setOpen(false);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            resetTypeahead();
            setOpen(false);
          } else if (
            event.key === 'Enter' ||
            (event.key === ' ' && typeaheadRef.current === '')
          ) {
            event.preventDefault();
            select(seasons[highlightedIndex]);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveHighlight(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (event.altKey) {
              resetTypeahead();
              setOpen(false);
            } else {
              moveHighlight(-1);
            }
          } else if (event.key === 'PageDown') {
            event.preventDefault();
            moveHighlight(10);
          } else if (event.key === 'PageUp') {
            event.preventDefault();
            moveHighlight(-10);
          } else if (event.key === 'Home') {
            event.preventDefault();
            setHighlightedIndex(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            setHighlightedIndex(seasons.length - 1);
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey
          ) {
            const matched = runTypeahead(event.key, highlightedIndex);
            if (!matched && event.key === ' ') {
              event.preventDefault();
              select(seasons[highlightedIndex]);
            }
          }
        }}
        className="flex h-11 w-full items-center justify-between rounded-md border lg:h-10 border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {`${seasonLabel(selectedSeason)} `}
        <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
      </button>

      {open ? (
        <div
          ref={popupRef}
          role="listbox"
          className="absolute right-0 z-50 mt-[18px] flex max-h-96 w-max min-w-full flex-col overflow-auto rounded-md border border-muted bg-background shadow-lg focus:outline-none"
          style={{ transform: `translateX(${popupOffset}px)` }}
        >
          {canScrollUp ? (
            <div
              aria-hidden="true"
              data-select-scroll-up-button=""
              className="flex w-full shrink-0 items-center justify-center py-1"
              onPointerDown={() => startAutoScroll(-1)}
              onPointerMove={() => startAutoScroll(-1)}
              onPointerUp={stopAutoScroll}
              onPointerCancel={stopAutoScroll}
              onPointerLeave={stopAutoScroll}
            >
              <ChevronsUp className="h-3 w-3 text-muted-foreground" />
            </div>
          ) : null}
          <div
            ref={viewportRef}
            data-select-viewport=""
            className="relative flex-[1_1_0%] overflow-auto p-1"
            onScroll={updateScrollControls}
          >
            {seasons.map((season, index) => {
              const isSelected = season.id === selectedSeason.id;
              const isHighlighted = index === highlightedIndex;
              return (
                <div
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  key={season.id}
                  id={`${id}-season-${index}`}
                  role="option"
                  aria-selected={isSelected ? true : undefined}
                  data-state={isSelected ? 'checked' : undefined}
                  data-highlighted={isHighlighted ? '' : undefined}
                  onPointerMove={(event) => {
                    if (event.pointerType !== 'touch') {
                      setHighlightedIndex(index);
                    }
                  }}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerUp={(event) => {
                    setHighlightedIndex(index);
                    if (event.pointerType === 'touch') return;
                    event.preventDefault();
                    select(season);
                  }}
                  onClick={() => select(season)}
                  className="flex h-10 w-full items-center justify-between rounded-md px-3 py-2 text-sm capitalize hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 data-[highlighted]:bg-muted data-[state=checked]:bg-accent data-[highlighted]:text-foreground data-[state=checked]:text-accent-foreground"
                >
                  {`${seasonLabel(season)} `}
                  {isSelected ? (
                    <Check className="ml-2 mr-1 h-4 w-4 text-ring" />
                  ) : null}
                </div>
              );
            })}
          </div>
          {canScrollDown ? (
            <div
              aria-hidden="true"
              data-select-scroll-down-button=""
              className="flex w-full shrink-0 items-center justify-center py-1"
              onPointerDown={() => startAutoScroll(1)}
              onPointerMove={() => startAutoScroll(1)}
              onPointerUp={stopAutoScroll}
              onPointerCancel={stopAutoScroll}
              onPointerLeave={stopAutoScroll}
            >
              <ChevronsDown className="h-3 w-3 text-muted-foreground" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
