import { toast } from 'sonner';

/**
 * Single place for user-visible notifications. Only meaningful events get a toast —
 * never low-level technical noise (ICE restarts, stats, etc.).
 */
export const notify = {
  info: (title: string, description?: string) => toast(title, { description }),
  success: (title: string, description?: string) => toast.success(title, { description }),
  warning: (title: string, description?: string) => toast.warning(title, { description }),
  error: (title: string, description?: string) => toast.error(title, { description }),
};
