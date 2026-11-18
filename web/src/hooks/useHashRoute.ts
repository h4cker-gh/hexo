import { useCallback, useEffect, useState } from 'react';

import { isRoute, type Route } from '@/config';

function readRoute(): Route {
  const value = window.location.hash.replace(/^#\/?/, '');
  return isRoute(value) ? value : 'dashboard';
}

/** Tab navigation backed by the URL hash, with back/forward support. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    if (!isRoute(window.location.hash.replace(/^#\/?/, ''))) {
      window.history.replaceState(null, '', '#/dashboard');
    }
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    setRoute(next);
    const hash = `#/${next}`;
    if (window.location.hash !== hash) window.location.hash = hash;
  }, []);

  return [route, navigate];
}
