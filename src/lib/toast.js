let _id = 0;

const DEFAULT_DURATION = { info: 4000, success: 3000, warning: 6000, error: 0 };

export function toast(message, type = 'info', { duration, sticky } = {}) {
  const autoSticky = type === 'error';
  window.dispatchEvent(new CustomEvent('app:toast', {
    detail: {
      id: ++_id,
      message,
      type,
      duration: duration ?? DEFAULT_DURATION[type] ?? 4000,
      sticky: sticky ?? autoSticky,
    }
  }));
}

toast.info    = (msg, opts) => toast(msg, 'info',    opts);
toast.success = (msg, opts) => toast(msg, 'success', opts);
toast.warning = (msg, opts) => toast(msg, 'warning', opts);
toast.error   = (msg, opts) => toast(msg, 'error',   opts);

export function showConfirm(message) {
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('app:confirm', {
      detail: { id: ++_id, message, resolve }
    }));
  });
}
