import { Linking } from 'react-native';
import { URL } from 'whatwg-url';
import auth from "@jasonpaulos/solid-auth-client/lib/index";

export function init() {
  Linking.addEventListener('url', handleOpenURL);

  Linking.getInitialURL()
    .then(url => {
      if (url) {
        handleOpenURL({ url })
      }
    }, err => {
      console.warn('Could not get initial app URL: ', err);
    });

  return () => {
    Linking.removeEventListener('url', handleOpenURL)
  };
}

async function handleOpenURL({ url }: { url: string }) {
  const urlObj = new URL(url.replace('#', '?'));
  const sessionStr = urlObj.searchParams.get('session');
  if (sessionStr) {
    try {
      const session = JSON.parse(decodeURIComponent(sessionStr));
      await auth.setSession(session);
    } catch (err) {
      console.warn('Could not set session from url: ', err);
    }
  }
}

export function onSessionChange(handler: (session: { webId: string } | null) => any) {
  auth.trackSession(handler);

  return () => auth.stopTrackSession(handler);
}

export const authenticatedFetch = auth.fetch;

export function logIn(): Promise<void> {
  return Linking.openURL('https://jasonpaulos.github.io/markbook-app/#appLogin');
}

export function logOut(): Promise<void> {
  return auth.logout();
}
