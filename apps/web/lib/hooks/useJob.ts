'use client';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useAuth } from './useAuth';
import { jobsApi, Job, JobStatus } from '../api';

// Req 38-39: After MAX_POLL_MS, stop polling and surface a "taking too long" flag.
// The backend handles recovery — the frontend just stops hammering the API.
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes

export function useJob(id: string | null) {
  const { accessToken } = useAuth();
  const pollStartRef = useRef<number | null>(null);
  const [pollExpired, setPollExpired] = useState(false);

  const { data: job, mutate } = useSWR<Job>(
    id && accessToken ? ['job', id] : null,
    () => jobsApi.get(accessToken!, id!),
    { refreshInterval: 0 }
  );

  // Poll whenever the job OR any individual slot is still in-flight.
  // Covers: initial generation AND slot-level regen (job stays DONE but slot goes PROCESSING).
  const hasInFlightSlots = job?.outputSlots?.some(
    (s) => s.status === 'PENDING' || s.status === 'PROCESSING'
  );
  const jobInFlight = job && (job.status === 'QUEUED' || job.status === 'PROCESSING');
  const wantsPoll = !!(id && accessToken && (jobInFlight || hasInFlightSlots));

  // Track when polling started — reset when job changes or we stop wanting to poll
  useEffect(() => {
    if (wantsPoll && !pollExpired) {
      if (pollStartRef.current === null) {
        pollStartRef.current = Date.now();
        setPollExpired(false);
      }
      // Check if we've exceeded the max poll window
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > MAX_POLL_MS) {
        console.warn(`useJob: polling timeout reached for job ${id} after ${elapsed / 1000}s`);
        setPollExpired(true);
      }
    }
    if (!wantsPoll) {
      pollStartRef.current = null;
      setPollExpired(false);
    }
  }, [wantsPoll, pollExpired, id]);

  const shouldPoll = wantsPoll && !pollExpired;

  useSWR<JobStatus>(
    shouldPoll ? ['job-status', id] : null,
    () => jobsApi.status(accessToken!, id!),
    {
      refreshInterval: POLL_INTERVAL_MS,
      onSuccess: () => {
        // Always re-fetch full job while polling so slot statuses update in UI
        mutate();
      },
    }
  );

  return { job, mutate, pollExpired };
}

export function useJobs(page = 1) {
  const { accessToken } = useAuth();
  return useSWR(
    accessToken ? ['jobs', page] : null,
    () => jobsApi.list(accessToken!, page)
  );
}
