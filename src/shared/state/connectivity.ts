export interface ConnectivityState {
  online: boolean;
  lastChangedAt: number;
}

type ConnectivitySubscriber = (state: ConnectivityState) => void;

const subscribers = new Set<ConnectivitySubscriber>();

const readNavigatorState = (): boolean => {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return true;
  }
  return navigator.onLine;
};

let connectivityState: ConnectivityState = {
  online: readNavigatorState(),
  lastChangedAt: Date.now()
};

let initialized = false;

const notifySubscribers = () => {
  for (const subscriber of subscribers) {
    subscriber(connectivityState);
  }
};

const setOnlineState = (online: boolean) => {
  if (connectivityState.online === online) {
    return;
  }
  connectivityState = {
    online,
    lastChangedAt: Date.now()
  };
  notifySubscribers();
};

const handleOnline = () => setOnlineState(true);
const handleOffline = () => setOnlineState(false);

const init = () => {
  if (initialized) {
    return;
  }
  initialized = true;

  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('online', handleOnline, { passive: true });
  window.addEventListener('offline', handleOffline, { passive: true });

  // Sync initial state after listeners are attached to avoid missing events.
  setOnlineState(readNavigatorState());
};

const subscribe = (subscriber: ConnectivitySubscriber): (() => void) => {
  subscribers.add(subscriber);
  subscriber(connectivityState);
  return () => {
    subscribers.delete(subscriber);
  };
};

const isOnline = (): boolean => connectivityState.online;
const getConnectivityState = (): ConnectivityState => connectivityState;

export const connectivityStore = {
  init,
  isOnline,
  getState: getConnectivityState,
  subscribe
} as const;
