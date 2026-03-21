import * as Linking from 'expo-linking';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { getEmberAppConfig, isInternalEmberUrl } from '@/lib/ember-app';

const appConfig = getEmberAppConfig();

export default function HomeScreen() {
  const webViewRef = useRef<WebView | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);

  if (!appConfig.isReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.eyebrow}>Ember mobile</Text>
          <Text style={styles.title}>Set the site URL first</Text>
          <Text style={styles.body}>{appConfig.message}</Text>
          <Text style={styles.code}>
            EXPO_PUBLIC_EMBER_APP_URL=https://your-ember-domain.com
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const openInBrowser = async () => {
    await Linking.openURL(appConfig.url);
  };

  const handleShouldStartLoad = (request: ShouldStartLoadRequest) => {
    if (isInternalEmberUrl(request.url, appConfig.origin)) {
      return true;
    }

    void Linking.openURL(request.url);
    return false;
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.webviewFrame}>
        <WebView
          ref={webViewRef}
          source={{ uri: appConfig.url }}
          pullToRefreshEnabled={Platform.OS === 'ios'}
          allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          sharedCookiesEnabled
          startInLoadingState
          setSupportMultipleWindows={false}
          onLoadStart={() => setHasLoadError(false)}
          onError={() => setHasLoadError(true)}
          onHttpError={() => setHasLoadError(true)}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          renderLoading={() => (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color="#ff6621" />
              <Text style={styles.loadingText}>Opening Ember...</Text>
            </View>
          )}
        />
      </View>

      {hasLoadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not load Ember</Text>
          <Text style={styles.errorBody}>
            Check that {appConfig.host} is reachable from this iPhone, then
            reload.
          </Text>
          <View style={styles.errorActions}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                setHasLoadError(false);
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.primaryButtonText}>Reload</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={openInBrowser}>
              <Text style={styles.secondaryButtonText}>Open in Safari</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff7f2',
  },
  webviewFrame: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff7f2',
  },
  eyebrow: {
    color: '#e25514',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 12,
    color: '#0f172a',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  body: {
    marginTop: 12,
    color: '#475569',
    fontSize: 16,
    lineHeight: 26,
  },
  code: {
    marginTop: 18,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff7f2',
  },
  loadingText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '500',
  },
  errorCard: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff7f2',
  },
  errorTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
  },
  errorBody: {
    marginTop: 6,
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#ff6621',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.12)',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
});
