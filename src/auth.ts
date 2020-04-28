import { Linking } from 'react-native';
import AsyncStorage from '@react-native-community/async-storage';
import { URL } from 'whatwg-url';
import auth from "@jasonpaulos/solid-auth-client/lib/index";

const sessionStorageKey = 'solid-session';

export function init() {
  Linking.addEventListener('url', handleOpenURL);

  loadSession();

  return () => {
    Linking.removeEventListener('url', handleOpenURL)
  };
}

async function loadSession() {
  let url = null;
  try {
    url = await Linking.getInitialURL();
  } catch (err) {
    console.warn('Could not get initial app URL: ', err);
  }

  if (url) {
    handleOpenURL({ url });
    return;
  }

  try {
    const session = await AsyncStorage.getItem(sessionStorageKey);
    if (session) {
      await auth.setSession(JSON.parse(session));
    }
  } catch (err) {
    console.warn('Could not read saved session: ', err);
  }
}

async function handleOpenURL({ url }: { url: string }) {
  const urlObj = new URL(url.replace('#', '?'));
  const sessionStr = urlObj.searchParams.get('session');
  if (sessionStr) {
    try {
      const session = JSON.parse(decodeURIComponent(sessionStr));
      await Promise.all([
        auth.setSession(session),
        AsyncStorage.setItem(sessionStorageKey, JSON.stringify(session)),
      ]);
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
  return Promise.all([
    auth.logout(),
    AsyncStorage.removeItem(sessionStorageKey),
  ]).then(() => {});
}
