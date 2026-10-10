import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Cache-buster memastikan APK tidak menampilkan HTML Worker lama setelah UI dirilis.
const MAIN_WEB_URL = 'https://c-zipper.corelink-ai.workers.dev/?app_release=1.2.7';
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
  var waiters = Object.create(null);
  function waitFor(id, phase, index, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete waiters[id];
        reject(new Error('Android tidak mengonfirmasi penulisan ZIP (' + phase + ').'));
      }, timeoutMs);
      waiters[id] = { phase: phase, index: index, resolve: resolve, reject: reject, timer: timer };
    });
  }
  window.__CZIPERR_TRANSFER_ACK__ = function (id, phase, index, ok, detail) {
    var waiter = waiters[id];
    if (!waiter || waiter.phase !== phase || waiter.index !== index) return false;
    clearTimeout(waiter.timer);
    delete waiters[id];
    if (ok) waiter.resolve(detail || null);
    else waiter.reject(new Error(String(detail || 'Penulisan ZIP ke penyimpanan internal gagal.')));
    return true;
  };
  function post(message) {
    if (!window.ReactNativeWebView) throw new Error('Bridge penyimpanan Android tidak tersedia.');
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  function toBase64(bytes) {
    var binary = '';
    for (var offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(offset + 32768, bytes.length)));
    }
    return btoa(binary);
  }
  async function saveZip(blob, filename) {
    if (!blob || !blob.size) throw new Error('ZIP kosong; tidak ada file untuk disimpan.');
    var id = 'zip_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    try {
      var ready = waitFor(id, 'ready', 0, 30000);
      post({ type: 'zip_save_begin', transferId: id, filename: filename, size: blob.size });
      await ready;
      var chunkSize = 256 * 1024;
      var count = Math.ceil(blob.size / chunkSize);
      for (var index = 0; index < count; index++) {
        var start = index * chunkSize;
        var bytes = new Uint8Array(await blob.slice(start, Math.min(start + chunkSize, blob.size)).arrayBuffer());
        var written = waitFor(id, 'chunk', index, 60000);
        post({ type: 'zip_save_chunk', transferId: id, index: index, base64: toBase64(bytes) });
        await written;
      }
      var complete = waitFor(id, 'complete', 0, 60000);
      post({ type: 'zip_save_finish', transferId: id });
      return await complete;
    } catch (error) {
      try { post({ type: 'zip_save_cancel', transferId: id }); } catch (_) {}
      throw error;
    }
  }
  window.__CZIPERR_SAVE_ZIP__ = saveZip;
  window.addEventListener('gc-native-zip-save-request', function (event) {
    var detail = event.detail || {};
    saveZip(detail.blob, detail.filename).then(function (result) {
      window.dispatchEvent(new CustomEvent('gc-native-zip-saved', { detail: result }));
    }).catch(function (error) {
      try { post({ type: 'zip_save_external_error', message: String(error && error.message || error) }); } catch (_) {}
    });
  });
  HTMLAnchorElement.prototype.click = function () {
    var anchor = this;
    var href = anchor.href || '';
    var name = anchor.download || '';
    var isZipDownload = name && (href.indexOf('blob:') === 0 || /\.zip(?:[?#]|$)/i.test(href) || /\/api\/(?:r2\/download|github\/(?:artifact|package\/download))/i.test(href));
    if (isZipDownload && window.ReactNativeWebView) {
      fetch(href).then(function (response) {
        if (!response.ok) throw new Error('Unduhan ZIP gagal (' + response.status + ').');
        return response.blob();
      }).then(function (blob) { return saveZip(blob, name); }).then(function (result) {
        window.dispatchEvent(new CustomEvent('gc-native-zip-saved', { detail: result }));
      }).catch(function (error) {
        try { post({ type: 'zip_save_external_error', message: String(error && error.message || error) }); } catch (_) {}
      });
      return;
    }
    return originalClick.call(anchor);
  };
})();
true;
`;

function safeDownloadName(value: string) {
  const cleaned = String(value || 'game-resources.zip').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return cleaned.toLowerCase().endsWith('.zip') ? cleaned : `${cleaned}.zip`;
}

type ZipTransfer = {
  file: File;
  handle: ReturnType<File['open']>;
  filename: string;
  expectedBytes: number;
  receivedBytes: number;
  nextIndex: number;
};

function acknowledgeZipTransfer(webView: WebView | null, transferId: string, phase: string, index: number, ok: boolean, detail: unknown) {
  const args = JSON.stringify([transferId, phase, index, ok, detail]);
  webView?.injectJavaScript(`if(window.__CZIPERR_TRANSFER_ACK__){window.__CZIPERR_TRANSFER_ACK__.apply(null,${args});} true;`);
}

function decodeBase64Chunk(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function discardZipTransfer(transfers: Map<string, ZipTransfer>, transferId: string) {
  const transfer = transfers.get(transferId);
  if (!transfer) return;
  transfers.delete(transferId);
  try { transfer.handle.close(); } catch { /* already closed */ }
  try { transfer.file.delete(); } catch { /* partial file cleanup is best effort */ }
}

async function handleZipTransferMessage(raw: string, transfers: Map<string, ZipTransfer>, webView: WebView | null) {
  let message: Record<string, unknown>;
  try { message = JSON.parse(raw) as Record<string, unknown>; } catch { return; }
  if (message.type === 'zip_save_external_error') {
    Alert.alert('Simpan ZIP gagal', String(message.message || 'ZIP tidak dapat disimpan ke penyimpanan internal.'));
    return;
  }
  const transferId = typeof message.transferId === 'string' ? message.transferId : '';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(transferId)) return;

  if (message.type === 'zip_save_begin') {
    let handle: ReturnType<File['open']> | null = null;
    try {
      const expectedBytes = Number(message.size);
      if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1) throw new Error('Ukuran ZIP tidak valid.');
      const available = Paths.availableDiskSpace;
      if (Number.isFinite(available) && available > 0 && expectedBytes + 16 * 1024 * 1024 > available) {
        throw new Error('Ruang internal HP tidak cukup untuk menyimpan ZIP ini. Kosongkan ruang lalu coba lagi.');
      }
      const filename = safeDownloadName(String(message.filename || 'game-resources.zip'));
      const directory = new Directory(Paths.document, 'captures');
      if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
      const file = new File(directory, filename);
      file.create({ overwrite: true, intermediates: true });
      handle = file.open();
      transfers.set(transferId, { file, handle, filename, expectedBytes, receivedBytes: 0, nextIndex: 0 });
      acknowledgeZipTransfer(webView, transferId, 'ready', 0, true, { filename });
    } catch (error) {
      try { handle?.close(); } catch { /* nothing to close */ }
      const reason = error instanceof Error ? error.message : 'ZIP tidak dapat disimpan.';
      acknowledgeZipTransfer(webView, transferId, 'ready', 0, false, reason);
      Alert.alert('Simpan ZIP gagal', reason);
    }
    return;
  }

  if (message.type === 'zip_save_cancel') {
    discardZipTransfer(transfers, transferId);
    return;
  }

  const transfer = transfers.get(transferId);
  if (!transfer) {
    const phase = message.type === 'zip_save_chunk' ? 'chunk' : 'complete';
    const index = Number(message.index) || 0;
    acknowledgeZipTransfer(webView, transferId, phase, index, false, 'Transfer ZIP tidak ditemukan; mulai ulang Collect.');
    return;
  }

  if (message.type === 'zip_save_chunk') {
    const index = Number(message.index);
    try {
      const encoded = typeof message.base64 === 'string' ? message.base64 : '';
      if (!Number.isSafeInteger(index) || index !== transfer.nextIndex) throw new Error('Urutan potongan ZIP tidak valid.');
      if (!encoded || encoded.length > 400_000) throw new Error('Potongan ZIP terlalu besar atau kosong.');
      const bytes = decodeBase64Chunk(encoded);
      if (transfer.receivedBytes + bytes.byteLength > transfer.expectedBytes) throw new Error('Ukuran ZIP melebihi manifest transfer.');
      transfer.handle.writeBytes(bytes);
      transfer.receivedBytes += bytes.byteLength;
      transfer.nextIndex++;
      acknowledgeZipTransfer(webView, transferId, 'chunk', index, true, { receivedBytes: transfer.receivedBytes });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Potongan ZIP tidak dapat ditulis.';
      discardZipTransfer(transfers, transferId);
      acknowledgeZipTransfer(webView, transferId, 'chunk', Number(message.index) || 0, false, reason);
      Alert.alert('Simpan ZIP gagal', reason);
    }
    return;
  }

  if (message.type === 'zip_save_finish') {
    try {
      if (transfer.receivedBytes !== transfer.expectedBytes) throw new Error('ZIP belum lengkap; jumlah byte yang tersimpan tidak cocok.');
      transfer.handle.close();
      const actualSize = transfer.file.info().size;
      if (actualSize !== transfer.expectedBytes) throw new Error('Ukuran file internal berbeda dari ZIP yang diterima.');
      transfers.delete(transferId);
      acknowledgeZipTransfer(webView, transferId, 'complete', 0, true, { filename: transfer.filename, bytes: actualSize });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'ZIP tersimpan tidak lengkap.';
      discardZipTransfer(transfers, transferId);
      acknowledgeZipTransfer(webView, transferId, 'complete', 0, false, reason);
      Alert.alert('Simpan ZIP gagal', reason);
    }
  }
}

export default function CollectorApp() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateManifest | null>(null);
  const [dismissedVersionCode, setDismissedVersionCode] = useState(0);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const webViewRef = useRef<WebView>(null);
  const zipTransfers = useRef(new Map<string, ZipTransfer>());
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
              ref={webViewRef}
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
              onMessage={(event) => { void handleZipTransferMessage(event.nativeEvent.data, zipTransfers.current, webViewRef.current); }}
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
