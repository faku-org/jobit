import { useEffect, useState } from "react";
import { fetchJob, isAbortError } from "../lib/api.ts";
import { describeJob } from "../lib/meta.ts";
import { setSharedJobId, sharedJobId } from "../lib/share.ts";
import type { Job } from "../lib/types.ts";

/**
 * Ties the open offer to the address bar in both directions: a shared link
 * opens its offer on arrival, and opening one puts it back in the URL so the
 * tab can be shared as it is.
 */
export function useJobLink(openJob: Job | null, onOpen: (job: Job) => void): void {
  /** Read once on mount: the effect below rewrites the address bar. */
  const [linked] = useState(sharedJobId);
  const [resolving, setResolving] = useState(linked !== null);

  useEffect(() => {
    if (linked === null) return;

    const controller = new AbortController();
    fetchJob(linked, controller.signal)
      .then((job) => {
        onOpen(job);
        setResolving(false);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setResolving(false);
      });

    return () => controller.abort();
  }, [linked, onOpen]);

  useEffect(() => {
    if (resolving) return;
    setSharedJobId(openJob?.id ?? null);
    if (!openJob) return;

    return describeJob(openJob);
  }, [openJob, resolving]);
}
