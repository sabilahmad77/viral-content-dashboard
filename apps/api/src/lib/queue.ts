import { EventEmitter } from 'events';

// In-process queue — no Redis needed for dev
class InProcessQueue extends EventEmitter {
  private jobs: Array<{ id: string; name: string; data: unknown }> = [];

  async add(name: string, data: unknown, opts?: { jobId?: string }) {
    const id = opts?.jobId ?? Math.random().toString(36).slice(2);
    const job = { id, name, data };
    this.jobs.push(job);
    // Process asynchronously on next tick
    setImmediate(() => this.emit('job', job));
    return job;
  }
}

export const jobQueue = new InProcessQueue();
export const jobQueueEvents = new EventEmitter();
export const queueConnection = null;
