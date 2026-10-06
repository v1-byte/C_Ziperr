import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Cache-buster memastikan APK tidak menampilkan HTML Worker lama setelah UI dirilis.
const MAIN_WEB_URL = 'https://c-zipper.corelink-ai.workers.dev/?app_release=1.2.6';
const UPDATE_MANIFEST_URL = 'https://github.com/v1-byte/C_Ziperr/releases/latest/download/update.json';
const ANDROID_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.fblabb.zipscope';
const CURRENT_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const CURRENT_VERSION_CODE = Number(Constants.expoConfig?.android?.versionCode ?? 0);
const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const MIN_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const UPDATE_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

type UpdateManifest = {
  appId: string;
  versionName: string;
  versionCode: number;
  releaseTag: string;
  apkSizeBytes: number;
  apkUrl: string;
};

function parseUpdateManifest(value: unknown): UpdateManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const { appId, versionName, versionCode, releaseTag, apkSizeBytes, apkUrl } = candidate;

  if (
    appId !== ANDROID_PACKAGE ||
    typeof versionName !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(versionName) ||
    typeof versionCode !== 'number' || !Number.isSafeInteger(versionCode) || versionCode <= CURRENT_VERSION_CODE ||
    typeof releaseTag !== 'string' || !/^apk-\d+$/.test(releaseTag) ||
    typeof apkSizeBytes !== 'number' || !Number.isSafeInteger(apkSizeBytes) || apkSizeBytes < 1_000_000 ||
    apkUrl !== `https://github.com/v1-byte/C_Ziperr/releases/download/${releaseTag}/app-release.apk`
  ) {
    return null;
  }

  return { appId, versionName, versionCode, releaseTag, apkSizeBytes, apkUrl };
}

const DOWNLOAD_BRIDGE = `
(function () {
  if (window.__CZIPERR_DOWNLOAD_BRIDGE__) return true;
  window.__CZIPERR_DOWNLOAD_BRIDGE__ = true;
  var originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var anchor = this;
    var href = anchor.href || '';
    var name = anchor.download || '';
    var isZipDownload = name && (href.indexOf('blob:') === 0 || /\.zip(?:[?#]|$)/i.test(href) || /\/api\/(?:r2\/download|github\/(?:artifact|package\/download))/i.test(href));
    if (isZipDownload && window.ReactNativeWebView) {
      fetch(href).then(function (response) { return response.blob(); }).then(function (blob) {
        var reader = new FileReader();
        reader.onloadend = function () {
          var result = String(reader.result || '');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'save_internal_download',
            filename: name,
            base64: result.split(',')[1] || ''
          }));
        };
        reader.readAsDataURL(blob);
      }).catch(function (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'save_internal_download_error', message: String(error && error.message || error) }));
        return originalClick.call(anchor);
      });
      return;
    }
    return originalClick.call(anchor);
  };
})();
true;
`;

function safeDownloadName(value: string) {
  const cleaned = String(value || 'game-resources.zip').replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.toLowerCase().endsWith('.zip') ? cleaned : `${cleaned}.zip`;
}

async function saveInternalDownload(raw: string) {
  const message = JSON.parse(raw);
  if (message?.type === 'save_internal_download_error') {
    Alert.alert('Simpan ZIP gagal', message.message || 'Download tidak dapat diproses.');
    return;
  }
  if (message?.type !== 'save_internal_download' || !message.base64) return;
  const filename = safeDownloadName(message.filename);
  const uri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, message.base64, { encoding: FileSystem.EncodingType.Base64 });
  Alert.alert('ZIP tersimpan', `${filename}\nDisimpan di penyimpanan internal C.Ziperr.`);
}

export default function CollectorApp() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateManifest | null>(null);
  const [dismissedVersionCode, setDismissedVersionCode] = useState(0);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const updateCheckInFlight = useRef(false);
  const installInProgress = useRef(false);
  const lastUpdateCheckAt = useRef(0);

  const checkForUpdate = useCallback(async () => {
    if (Platform.OS !== 'android' || updateCheckInFlight.current) return;
    if (lastUpdateCheckAt.current && Date.now() - lastUpdateCheckAt.current < MIN_UPDATE_CHECK_INTERVAL_MS) return;

    updateCheckInFlight.current = true;
    lastUpdateCheckAt.current = Date.now();
    try {
      const response = await fetch(`${UPDATE_MANIFEST_URL}?refresh=${Date.now()}`, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) return;
      const manifest = parseUpdateManifest(await response.json());
      if (manifest) setUpdateInfo(manifest);
    } catch {
      // Update check tidak boleh mengganggu UI atau proses capture saat jaringan/API tidak tersedia.
    } finally {
      updateCheckInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void checkForUpdate();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdate();
    });
    const poll = setInterval(() => void checkForUpdate(), UPDATE_POLL_INTERVAL_MS);
    return () => {
      appStateSubscription.remove();
      clearInterval(poll);
    };
  }, [checkForUpdate]);

  const downloadAndInstallUpdate = async () => {
    if (!updateInfo || installInProgress.current) return;
    installInProgress.current = true;
    setUpdateProgress(0);
    try {
      const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDirectory) throw new Error('Penyimpanan sementara tidak tersedia.');
      const destination = `${baseDirectory}c-ziperr-update-${updateInfo.versionCode}.apk`;
      await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);

      const download = FileSystem.createDownloadResumable(
        updateInfo.apkUrl,
        destination,
        { headers: { Accept: APK_MIME_TYPE } },
        (progress) => {
          if (progress.totalBytesExpectedToWrite > 0) {
            const percent = Math.floor((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100);
            setUpdateProgress(Math.min(99, Math.max(0, percent)));
          }
        },
      );
      const result = await download.downloadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error('Unduhan APK tidak selesai. Periksa koneksi lalu coba lagi.');
      }

      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists || fileInfo.size !== updateInfo.apkSizeBytes) {
        throw new Error('Ukuran APK tidak cocok dengan rilis. Unduh ulang sebelum memasang.');
      }

      setUpdateProgress(100);
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: contentUri,
        type: APK_MIME_TYPE,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION untuk Android Package Installer.
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'APK tidak dapat diunduh atau dipasang.';
      Alert.alert('Pembaruan C.Ziperr gagal', `${message}\n\nJika diminta Android, izinkan pemasangan dari C.Ziperr lalu konfirmasi pemasangan.`);
    } finally {
      installInProgress.current = false;
      setUpdateProgress(null);
    }
  };

  const updateButtonLabel = updateProgress === null
    ? 'Perbarui'
    : updateProgress >= 100
      ? 'Buka pemasang…'
      : updateProgress > 0
        ? `Unduh ${updateProgress}%`
        : 'Mengunduh…';

  const updatePrompt = updateInfo && dismissedVersionCode !== updateInfo.versionCode ? (
    <View style={styles.updateBanner} accessibilityRole="summary">
      <View style={styles.updateCopy}>
        <Text style={styles.updateTitle}>Pembaruan tersedia · v{updateInfo.versionName}</Text>
        <Text style={styles.updateMessage}>Unduh APK dan lanjutkan pemasangan melalui konfirmasi Android.</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Unduh dan pasang C.Ziperr versi ${updateInfo.versionName}`}
        style={[styles.updateButton, updateProgress !== null && styles.updateButtonBusy]}
        onPress={() => { void downloadAndInstallUpdate(); }}
        disabled={updateProgress !== null}
      >
        {updateProgress !== null && <ActivityIndicator size="small" color="#0e1116" />}
        <Text style={styles.updateButtonText}>{updateButtonLabel}</Text>
      </Pressable>
      {updateProgress === null && (
        <Pressable accessibilityRole="button" accessibilityLabel="Nanti" onPress={() => setDismissedVersionCode(updateInfo.versionCode)} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Nanti</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0e1116" />
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        {failed ? (
          <View style={styles.error}>
            <Text style={styles.title}>C.Ziperr</Text>
            <Text style={styles.message}>Web utama tidak dapat dibuka. Periksa koneksi internet lalu coba lagi.</Text>
            <Pressable style={styles.button} onPress={() => { setFailed(false); setLoading(true); }}>
              <Text style={styles.buttonText}>Coba lagi</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(MAIN_WEB_URL)}>
              <Text style={styles.link}>Buka di browser</Text>
            </Pressable>
            {updatePrompt}
          </View>
        ) : (
          <View style={styles.content}>
            <WebView
              source={{ uri: MAIN_WEB_URL }}
              style={styles.webview}
              originWhitelist={['https://*']}
              cacheEnabled={false}
              cacheMode="LOAD_NO_CACHE"
              injectedJavaScriptBeforeContentLoaded={DOWNLOAD_BRIDGE}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              onLoadStart={() => { setLoading(true); setFailed(false); }}
              onLoadEnd={() => setLoading(false)}
              onError={() => { setLoading(false); setFailed(true); }}
              onHttpError={(event) => { if (event.nativeEvent.statusCode >= 500) { setLoading(false); setFailed(true); } }}
              onMessage={(event) => { saveInternalDownload(event.nativeEvent.data).catch((error) => Alert.alert('Simpan ZIP gagal', error?.message || 'File tidak dapat disimpan.')); }}
            />
            {loading && <View style={styles.loading}><ActivityIndicator size="large" color="#5ee1c0" /><Text style={styles.loadingText}>Memuat C.Ziperr…</Text></View>}
            {updatePrompt}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e1116' },
  content: { flex: 1, minHeight: 0 },
  webview: { flex: 1, backgroundColor: '#0e1116' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0e1116' },
  loadingText: { color: '#e6e9ee', marginTop: 14, fontSize: 14 },
  updateBanner: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 5, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1, borderColor: '#5ee1c0', borderRadius: 14, backgroundColor: '#16211f', elevation: 8 },
  updateCopy: { flex: 1, minWidth: 0 },
  updateTitle: { color: '#e9fff9', fontSize: 14, fontWeight: '700' },
  updateMessage: { color: '#b7c8c3', fontSize: 12, lineHeight: 17, marginTop: 4 },
  updateButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, paddingHorizontal: 12, backgroundColor: '#5ee1c0' },
  updateButtonBusy: { minWidth: 86 },
  updateButtonText: { color: '#0e1116', fontSize: 12, fontWeight: '800' },
  dismissButton: { position: 'absolute', top: 4, right: 4, paddingHorizontal: 7, paddingVertical: 3 },
  dismissText: { color: '#b7c8c3', fontSize: 11, fontWeight: '600' },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#0e1116' },
  title: { color: '#5ee1c0', fontSize: 24, fontWeight: '700' },
  message: { color: '#b0b8c4', textAlign: 'center', lineHeight: 22, marginTop: 12, marginBottom: 22 },
  button: { backgroundColor: '#2e5c52', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: '#ffffff', fontWeight: '700' },
  link: { color: '#5ee1c0', marginTop: 18, fontWeight: '600' },
});
