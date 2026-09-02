import { useEffect, useState } from "react";
import { type CustomFeed, type FeedResult, fetchFeed } from "../lib/feed.ts";
import type { Job } from "../lib/types.ts";

export interface CustomFeedState {
  jobs: Job[];
  /** One entry per enabled feed, so the panel can report each one's fate. */
  results: FeedResult[];
  loading: boolean;
}

/**
 * Reads the feeds somebody added, in the browser and in parallel. A feed that
 * fails is reported and skipped: one bad url must not take the list with it.
 */
export function useCustomFeeds(feeds: CustomFeed[]): CustomFeedState {
  const enabled = feeds.filter((feed) => feed.enabled && feed.url.trim() !== "");
  /** Refetch when a url, a label or a switch changes, not on every render. */
  const key = JSON.stringify(enabled.map((feed) => [feed.id, feed.url, feed.label]));

  const [state, setState] = useState<CustomFeedState>({ jobs: [], results: [], loading: false });

  useEffect(() => {
    const list: CustomFeed[] = JSON.parse(key).map(
      ([id, url, label]: [string, string, string]) => ({
        id,
        url,
        label,
        enabled: true,
      }),
    );

    if (list.length === 0) {
      setState({ jobs: [], results: [], loading: false });
      return;
    }

    let live = true;
    setState((current) => ({ ...current, loading: true }));

    Promise.all(list.map((feed) => fetchFeed(feed))).then((results) => {
      if (!live) return;
      setState({ jobs: results.flatMap((result) => result.jobs), results, loading: false });
    });

    return () => {
      live = false;
    };
  }, [key]);

  return state;
}
