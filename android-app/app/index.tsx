import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { File as NativeFile, type FileHandle, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Cache-buster memastikan APK tidak menampilkan HTML Worker lama setelah UI dirilis.
const MAIN_WEB_URL = 'https://c-zipper.corelink-ai.workers.dev/?app_release=1.3.0';
const UPDATE_MANIFEST_URL = 'https://github.com/v1-byte/C_Ziperr/releases/latest/download/update.json';
const ANDROID_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.fblabb.zipscope';
const CURRENT_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const CURRENT_VERSION_CODE = Number(Constants.expoConfig?.android?.versionCode ?? 0);
const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const MIN_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const UPDATE_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INTERNAL_DOWNLOAD_HOST = 'c-zipper.corelink-ai.workers.dev';

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

const DOWNLOAD_CHUNK_BYTES = 192 * 1024;
const WORKSPACE_IMPORT_CHUNK_BYTES = 192 * 1024;
const DOWNLOAD_BRIDGE = `
(function () {
  if (window.__CZIPERR_DOWNLOAD_BRIDGE__) return true;
  window.__CZIPERR_DOWNLOAD_BRIDGE__ = true;
  var CHUNK_BYTES = ${DOWNLOAD_CHUNK_BYTES};
  var waiters = Object.create(null);
  var activeId = null;
  window.__CZIPERR_DOWNLOAD_ACK = function (raw) {
    try {
      var ack = typeof raw === 'string' ? JSON.parse(raw) : raw;
      var key = ack.id + ':' + ack.index;
      var waiter = waiters[key];
      if (!waiter) return;
      delete waiters[key];
      clearTimeout(waiter.timer);
      if (ack.error) waiter.reject(new Error(ack.error)); else waiter.resolve();
    } catch (_) {}
  };
  function sendAndWait(message, index) {
    var key = message.id + ':' + index;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete waiters[key];
        reject(new Error('Penyimpanan internal tidak merespons.'));
      }, 60000);
      waiters[key] = { resolve: resolve, reject: reject, timer: timer };
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    });
  }
  function readBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '').split(',')[1] || ''); };
      reader.onerror = function () { reject(new Error('Gagal membaca potongan ZIP.')); };
      reader.readAsDataURL(blob);
    });
  }
  async function transferZip(blob, filename) {
    var id = 'zip-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    if (activeId) throw new Error('Penyimpanan ZIP lain masih berlangsung.');
    activeId = id;
    try {
      await sendAndWait({ type: 'save_internal_download_start', id: id, filename: filename, size: blob.size }, -1);
      var index = 0;
      for (var offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
        var part = blob.slice(offset, Math.min(blob.size, offset + CHUNK_BYTES));
        var base64 = await readBase64(part);
        await sendAndWait({ type: 'save_internal_download_chunk', id: id, index: index, base64: base64 }, index);
        index += 1;
      }
      await sendAndWait({ type: 'save_internal_download_complete', id: id, chunks: index, size: blob.size }, index);
    } catch (error) {
      error.downloadId = id;
      throw error;
    } finally {
      activeId = null;
    }
  }
  var originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var anchor = this;
    var href = anchor.href || '';
    var name = anchor.download || '';
    var isZipDownload = name && (href.indexOf('blob:') === 0 || /\.zip(?:[?#]|$)/i.test(href) || /\/api\/(?:r2\/download|github\/(?:artifact|package\/download))/i.test(href));
    if (isZipDownload && window.ReactNativeWebView) {
      fetch(href).then(function (response) {
        if (!response.ok) throw new Error('Server mengembalikan HTTP ' + response.status);
        return response.blob();
      }).then(function (blob) {
        return transferZip(blob, name);
      }).catch(function (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'save_internal_download_error', id: error && error.downloadId || null, message: String(error && error.message || error) }));
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
function isTrustedInternalDownloadUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return host === INTERNAL_DOWNLOAD_HOST || host === 'github.com' || host.endsWith('.github.com') ||
      host.endsWith('.githubusercontent.com') || host.endsWith('.actions.githubusercontent.com') ||
      host.endsWith('.blob.core.windows.net');
  } catch {
    return false;
  }
}
function decodeBase64Chunk(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(Math.floor((value.length * 3) / 4));
  let accumulator = 0;
  let bitCount = 0;
  let offset = 0;
  for (const character of value) {
    if (character === '=') break;
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Potongan ZIP mengandung Base64 yang tidak valid.');
    accumulator = (accumulator << 6) | digit;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[offset++] = (accumulator >> bitCount) & 0xff;
    }
  }
  return bytes.subarray(0, offset);
}
type ActiveInternalDownload = {
  id: string;
  filename: string;
  expectedSize: number;
  receivedBytes: number;
  nextIndex: number;
  partFile: NativeFile;
  handle: FileHandle;
};
type SavedZip = { name: string; size: number; uri: string };
type WorkspaceImportWaiter = { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CollectorApp() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateManifest | null>(null);
  const [dismissedVersionCode, setDismissedVersionCode] = useState(0);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [workspaceImportProgress, setWorkspaceImportProgress] = useState<number | null>(null);
  const [savedFiles, setSavedFiles] = useState<SavedZip[]>([]);
  const [savedFilesVisible, setSavedFilesVisible] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const activeDownloadRef = useRef<ActiveInternalDownload | null>(null);
  const directDownloadInProgress = useRef(false);
  const workspaceImportWaitersRef = useRef(new Map<string, WorkspaceImportWaiter>());
  const workspaceImportInProgressRef = useRef(false);
  const messageQueueRef = useRef<Promise<void>>(Promise.resolve());
  const updateCheckInFlight = useRef(false);
  const installInProgress = useRef(false);
  const lastUpdateCheckAt = useRef(0);

  const refreshSavedFiles = useCallback(() => {
    try {
      const files = Paths.document.list()
        .filter((entry): entry is NativeFile => entry instanceof NativeFile && entry.name.toLowerCase().endsWith('.zip'))
        .map((file) => ({ name: file.name, size: file.size, uri: file.uri }))
        .sort((left, right) => right.name.localeCompare(left.name));
      setSavedFiles(files);
    } catch {
      setSavedFiles([]);
    }
  }, []);

  useEffect(() => {
    try {
      for (const entry of Paths.document.list()) {
        if (entry instanceof NativeFile && entry.name.startsWith('.cziperr-') && entry.name.endsWith('.part')) {
          entry.delete();
        }
      }
    } catch {
      // File listing is best effort; saving itself reports storage errors to the user.
    }
    refreshSavedFiles();
  }, [refreshSavedFiles]);

  const acknowledgeDownload = (id: string, index: number, error?: string) => {
    const payload = JSON.stringify(JSON.stringify({ id, index, error: error || null }));
    webViewRef.current?.injectJavaScript(`window.__CZIPERR_DOWNLOAD_ACK && window.__CZIPERR_DOWNLOAD_ACK(${payload}); true;`);
  };

  const sendWorkspaceZipMessage = (message: Record<string, string | number>, index: number) => new Promise<void>((resolve, reject) => {
    const id = String(message.id || ''), key = `${id}:${index}`;
    if (!webViewRef.current) { reject(new Error('Workspace WebView belum siap.')); return; }
    const timer = setTimeout(() => {
      workspaceImportWaitersRef.current.delete(key);
      reject(new Error('Workspace tidak merespons pemuatan ZIP.'));
    }, 60_000);
    workspaceImportWaitersRef.current.set(key, { resolve, reject, timer });
    try {
      webViewRef.current.injectJavaScript(`window.__CZIPERR_IMPORT_SAVED_ZIP && window.__CZIPERR_IMPORT_SAVED_ZIP(${JSON.stringify(message)}); true;`);
    } catch (error) {
      clearTimeout(timer);
      workspaceImportWaitersRef.current.delete(key);
      reject(error instanceof Error ? error : new Error('Gagal mengirim ZIP ke Workspace.'));
    }
  });

  const discardActiveDownload = (active: ActiveInternalDownload) => {
    try { active.handle.close(); } catch { /* handle may already be closed */ }
    try { if (active.partFile.exists) active.partFile.delete(); } catch { /* best-effort cleanup */ }
    if (activeDownloadRef.current?.id === active.id) activeDownloadRef.current = null;
    setDownloadProgress(null);
  };

  const handleInternalDownloadMessage = async (raw: string) => {
    let message: Record<string, unknown>;
    try { message = JSON.parse(raw) as Record<string, unknown>; } catch { return; }
    if (message.type === 'save_internal_download_error') {
      const active = activeDownloadRef.current;
      if (active && String(message.id || '') === active.id) discardActiveDownload(active);
      Alert.alert('Simpan ZIP gagal', String(message.message || 'Download tidak dapat diproses.'));
      return;
    }
    if (message.type === 'open_saved_zip_list') {
      refreshSavedFiles();
      setSavedFilesVisible(true);
      return;
    }
    if (message.type === 'load_saved_zip_ack') {
      const key = `${String(message.id || '')}:${Number(message.index)}`;
      const waiter = workspaceImportWaitersRef.current.get(key);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      workspaceImportWaitersRef.current.delete(key);
      if (message.error) waiter.reject(new Error(String(message.error)));
      else waiter.resolve();
      return;
    }
    const id = String(message.id || '');
    if (!/^[a-zA-Z0-9_-]{6,100}$/.test(id)) return;
    if (message.type === 'save_internal_download_url') {
      let partFile: NativeFile | null = null;
      directDownloadInProgress.current = true;
      try {
        if (activeDownloadRef.current) throw new Error('Masih ada ZIP lain yang sedang disimpan.');
        const url = String(message.url || '');
        if (!isTrustedInternalDownloadUrl(url)) throw new Error('Host URL unduhan tidak termasuk allowlist aman.');
        const expectedSize = Number(message.size);
        if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) throw new Error('Ukuran ZIP tidak valid.');
        const availableBytes = Paths.availableDiskSpace;
        if (Number.isFinite(availableBytes) && expectedSize > Math.max(0, availableBytes - 1024 * 1024)) {
          throw new Error(`Ruang internal tidak cukup. ZIP ${formatFileSize(expectedSize)}; ruang kosong sekitar ${formatFileSize(availableBytes)}.`);
        }
        const filename = safeDownloadName(String(message.filename || 'game-resources.zip'));
        const usedNames = new Set(Paths.document.list().map((entry) => entry.name.toLowerCase()));
        const stem = filename.slice(0, filename.toLowerCase().lastIndexOf('.zip'));
        let uniqueName = filename;
        let suffix = 2;
        while (usedNames.has(uniqueName.toLowerCase())) uniqueName = `${stem}-${suffix++}.zip`;
        partFile = new NativeFile(Paths.document, `.cziperr-${id}.part`);
        if (partFile.exists) partFile.delete();
        partFile.create({ intermediates: true, overwrite: true });
        setDownloadProgress(0);
        const download = FileSystem.createDownloadResumable(
          url,
          partFile.uri,
          { headers: { Accept: 'application/zip' } },
          (progress) => {
            if (progress.totalBytesExpectedToWrite > 0) {
              setDownloadProgress(Math.min(99, Math.floor((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100)));
            }
          },
        );
        const result = await download.downloadAsync();
        if (!result || result.status < 200 || result.status >= 300) throw new Error(`Unduhan ZIP gagal dengan HTTP ${result?.status ?? 'tidak diketahui'}.`);
        if (partFile.size !== expectedSize) throw new Error(`Ukuran ZIP tidak cocok (${formatFileSize(partFile.size)} dari ${formatFileSize(expectedSize)}).`);
        const finalFile = new NativeFile(Paths.document, uniqueName);
        if (finalFile.exists) finalFile.delete();
        partFile.move(finalFile);
        partFile = null;
        refreshSavedFiles();
        setDownloadProgress(null);
        Alert.alert('ZIP tersimpan', `${uniqueName} · ${formatFileSize(expectedSize)}\nTersimpan di memori internal aplikasi C.Ziperr. Buka “File tersimpan” lalu pilih “Workspace” untuk mengeditnya.`);
      } catch (error) {
        try { if (partFile?.exists) partFile.delete(); } catch { /* best-effort cleanup */ }
        setDownloadProgress(null);
        throw error;
      } finally {
        directDownloadInProgress.current = false;
      }
      return;
    }
    if (message.type === 'save_internal_download_start') {
      let pendingFile: NativeFile | null = null;
      try {
        if (activeDownloadRef.current || directDownloadInProgress.current) throw new Error('Masih ada ZIP lain yang sedang disimpan.');
        const expectedSize = Number(message.size);
        if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) throw new Error('Ukuran ZIP tidak valid.');
        const availableBytes = Paths.availableDiskSpace;
        if (Number.isFinite(availableBytes) && expectedSize > Math.max(0, availableBytes - 1024 * 1024)) {
          throw new Error(`Ruang internal tidak cukup. ZIP ${formatFileSize(expectedSize)}; ruang kosong sekitar ${formatFileSize(availableBytes)}.`);
        }
        const filename = safeDownloadName(String(message.filename || 'game-resources.zip'));
        const usedNames = new Set(Paths.document.list().map((entry) => entry.name.toLowerCase()));
        const dot = filename.toLowerCase().lastIndexOf('.zip');
        const stem = filename.slice(0, dot);
        let uniqueName = filename;
        let suffix = 2;
        while (usedNames.has(uniqueName.toLowerCase())) uniqueName = `${stem}-${suffix++}.zip`;
        pendingFile = new NativeFile(Paths.document, `.cziperr-${id}.part`);
        if (pendingFile.exists) pendingFile.delete();
        pendingFile.create({ intermediates: true, overwrite: true });
        const active: ActiveInternalDownload = {
          id, filename: uniqueName, expectedSize, receivedBytes: 0, nextIndex: 0,
          partFile: pendingFile, handle: pendingFile.open(),
        };
        activeDownloadRef.current = active;
        setDownloadProgress(0);
        acknowledgeDownload(id, -1);
      } catch (error) {
        try { if (pendingFile?.exists) pendingFile.delete(); } catch { /* best-effort cleanup */ }
        const reason = error instanceof Error ? error.message : 'Tidak dapat menyiapkan penyimpanan internal.';
        acknowledgeDownload(id, -1, reason);
      }
      return;
    }
    const active = activeDownloadRef.current;
    const messageIndex = Number(message.index ?? message.chunks);
    if (!active || active.id !== id) {
      acknowledgeDownload(id, messageIndex, 'Sesi penyimpanan ZIP tidak ditemukan.');
      return;
    }
    if (message.type === 'save_internal_download_chunk') {
      try {
        const index = Number(message.index);
        if (!Number.isSafeInteger(index) || index !== active.nextIndex) throw new Error('Urutan potongan ZIP tidak valid.');
        const bytes = decodeBase64Chunk(String(message.base64 || ''));
        if (active.receivedBytes + bytes.byteLength > active.expectedSize) throw new Error('Ukuran data ZIP melewati ukuran yang dijanjikan.');
        active.handle.writeBytes(bytes);
        active.receivedBytes += bytes.byteLength;
        active.nextIndex += 1;
        setDownloadProgress(Math.min(99, Math.floor((active.receivedBytes / active.expectedSize) * 100)));
        acknowledgeDownload(id, index);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Penulisan ZIP ke memori internal gagal.';
        discardActiveDownload(active);
        acknowledgeDownload(id, Number(message.index), reason);
      }
      return;
    }
    if (message.type === 'save_internal_download_complete') {
      try {
        if (active.receivedBytes !== active.expectedSize || Number(message.size) !== active.expectedSize || Number(message.chunks) !== active.nextIndex) {
          throw new Error(`ZIP tidak lengkap (${formatFileSize(active.receivedBytes)} dari ${formatFileSize(active.expectedSize)}).`);
        }
        active.handle.close();
        if (active.partFile.size !== active.expectedSize) {
          throw new Error(`Ukuran file di penyimpanan tidak cocok (${formatFileSize(active.partFile.size)} dari ${formatFileSize(active.expectedSize)}).`);
        }
        const finalFile = new NativeFile(Paths.document, active.filename);
        if (finalFile.exists) finalFile.delete();
        active.partFile.move(finalFile);
        activeDownloadRef.current = null;
        setDownloadProgress(null);
        refreshSavedFiles();
        acknowledgeDownload(id, active.nextIndex);
        Alert.alert('ZIP tersimpan', `${active.filename} · ${formatFileSize(active.expectedSize)}\nTersimpan di memori internal aplikasi C.Ziperr. Buka “File tersimpan” lalu pilih “Workspace” untuk mengeditnya.`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Tidak dapat menyelesaikan penyimpanan ZIP.';
        discardActiveDownload(active);
        acknowledgeDownload(id, Number(message.chunks), reason);
      }
    }
  };

  const openSavedFile = async (file: SavedZip) => {
    try {
      const contentUri = await FileSystem.getContentUriAsync(file.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/zip',
        flags: 1,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Tidak ada aplikasi yang dapat membuka ZIP ini.';
      Alert.alert('Tidak dapat membuka ZIP', `${reason}\nFile tetap tersimpan di aplikasi.`);
    }
  };

  const loadSavedZipToWorkspace = async (file: SavedZip) => {
    if (workspaceImportInProgressRef.current) return;
    const id = `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const chunks = Math.ceil(file.size / WORKSPACE_IMPORT_CHUNK_BYTES);
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || chunks <= 0) {
      Alert.alert('ZIP tidak valid', 'File tersimpan kosong atau ukuran file tidak valid.');
      return;
    }
    workspaceImportInProgressRef.current = true;
    try {
      setSavedFilesVisible(false);
      setWorkspaceImportProgress(0);
      await sendWorkspaceZipMessage({ type: 'load_saved_zip_start', id, index: -1, filename: file.name, size: file.size, chunks }, -1);
      for (let index = 0, position = 0; position < file.size; index += 1, position += WORKSPACE_IMPORT_CHUNK_BYTES) {
        const length = Math.min(WORKSPACE_IMPORT_CHUNK_BYTES, file.size - position);
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
          position,
          length,
        });
        if (!base64) throw new Error('Potongan ZIP tersimpan tidak dapat dibaca.');
        await sendWorkspaceZipMessage({ type: 'load_saved_zip_chunk', id, index, base64 }, index);
        setWorkspaceImportProgress(Math.min(99, Math.floor(((position + length) / file.size) * 100)));
      }
      await sendWorkspaceZipMessage({ type: 'load_saved_zip_complete', id, index: chunks, chunks, size: file.size }, chunks);
      setWorkspaceImportProgress(null);
    } catch (error) {
      setWorkspaceImportProgress(null);
      Alert.alert('Tidak dapat memuat ke Workspace', error instanceof Error ? error.message : 'ZIP tetap tersimpan di memori aplikasi.');
    } finally {
      workspaceImportInProgressRef.current = false;
    }
  };

  const confirmDeleteSavedFile = (file: SavedZip) => {
    Alert.alert('Hapus ZIP?', `${file.name} akan dihapus dari memori internal aplikasi.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => {
        try { new NativeFile(Paths.document, file.name).delete(); refreshSavedFiles(); }
        catch (error) { Alert.alert('Hapus gagal', error instanceof Error ? error.message : 'File tidak dapat dihapus.'); }
      } },
    ]);
  };

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
              onMessage={(event) => {
                const raw = event.nativeEvent.data;
                messageQueueRef.current = messageQueueRef.current
                  .then(() => handleInternalDownloadMessage(raw))
                  .catch((error) => {
                    const active = activeDownloadRef.current;
                    if (active) discardActiveDownload(active);
                    Alert.alert('Simpan ZIP gagal', error?.message || 'File tidak dapat disimpan.');
                  });
              }}
            />
            {loading && <View style={styles.loading}><ActivityIndicator size="large" color="#5ee1c0" /><Text style={styles.loadingText}>Memuat C.Ziperr…</Text></View>}
            {(downloadProgress !== null || workspaceImportProgress !== null) && (
              <View style={styles.downloadBanner} accessibilityRole="summary">
                <ActivityIndicator size="small" color="#5ee1c0" />
                <Text style={styles.downloadBannerText}>
                  {workspaceImportProgress !== null ? `Memuat ZIP ke Workspace · ${workspaceImportProgress}%` : `Menyimpan ZIP ke internal · ${downloadProgress}%`}
                </Text>
              </View>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel={`Lihat ${savedFiles.length} file ZIP tersimpan`} style={styles.savedFilesButton} onPress={() => { refreshSavedFiles(); setSavedFilesVisible(true); }}>
              <Text style={styles.savedFilesButtonText}>File tersimpan · {savedFiles.length}</Text>
            </Pressable>
            {updatePrompt}
          </View>
        )}
        <Modal visible={savedFilesVisible} transparent animationType="slide" onRequestClose={() => setSavedFilesVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Hasil ZIP tersimpan</Text>
                  <Text style={styles.modalSubtitle}>Disimpan di memori internal privat aplikasi C.Ziperr.</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Tutup daftar file" onPress={() => setSavedFilesVisible(false)} style={styles.modalClose}>
                  <Text style={styles.modalCloseText}>Tutup</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.savedFilesList} contentContainerStyle={styles.savedFilesContent}>
                {savedFiles.length === 0 ? (
                  <Text style={styles.emptyFilesText}>Belum ada ZIP tersimpan. Selesaikan Collect lalu unduh hasilnya dari aplikasi.</Text>
                ) : savedFiles.map((file) => (
                  <View key={file.name} style={styles.savedFileRow}>
                    <View style={styles.savedFileCopy}>
                      <Text style={styles.savedFileName} numberOfLines={2}>{file.name}</Text>
                      <Text style={styles.savedFileSize}>{formatFileSize(file.size)}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${file.name} di Workspace`} disabled={workspaceImportProgress !== null} onPress={() => { void loadSavedZipToWorkspace(file); }} style={[styles.fileActionButton, styles.workspaceActionButton]}>
                      <Text style={styles.fileActionText}>Workspace</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => { void openSavedFile(file); }} style={styles.fileActionButton}>
                      <Text style={styles.fileActionText}>Buka</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Hapus ${file.name}`} onPress={() => confirmDeleteSavedFile(file)} style={[styles.fileActionButton, styles.deleteActionButton]}>
                      <Text style={[styles.fileActionText, styles.deleteActionText]}>Hapus</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.storageNote}>Gunakan Workspace untuk mengedit berkas teks, lalu Ekspor ZIP untuk menyimpan versi baru. File tetap tersimpan di ruang internal aplikasi sampai dihapus.</Text>
            </View>
          </View>
        </Modal>
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
  downloadBanner: { position: 'absolute', left: 12, right: 12, bottom: 62, zIndex: 5, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: '#5ee1c0', borderRadius: 12, backgroundColor: '#16211f', elevation: 7 },
  downloadBannerText: { color: '#e9fff9', fontSize: 12, fontWeight: '700' },
  savedFilesButton: { position: 'absolute', left: 12, bottom: 12, zIndex: 5, minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#5ee1c0', borderRadius: 12, backgroundColor: '#16211f', elevation: 7 },
  savedFilesButtonText: { color: '#e9fff9', fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  modalCard: { maxHeight: '82%', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 26, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#101820' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#34434d' },
  modalHeaderCopy: { flex: 1 },
  modalTitle: { color: '#e9fff9', fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: '#b0b8c4', fontSize: 12, lineHeight: 17, marginTop: 5 },
  modalClose: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#263a40' },
  modalCloseText: { color: '#e9fff9', fontSize: 12, fontWeight: '700' },
  savedFilesList: { flexGrow: 0, marginTop: 8 },
  savedFilesContent: { gap: 10, paddingVertical: 10 },
  savedFileRow: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderWidth: 1, borderColor: '#2e414b', borderRadius: 12, backgroundColor: '#152129' },
  savedFileCopy: { flex: 1, minWidth: 0 },
  savedFileName: { color: '#e6e9ee', fontSize: 12, fontWeight: '700' },
  savedFileSize: { color: '#9eacb4', fontSize: 11, marginTop: 4 },
  fileActionButton: { minWidth: 50, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#234a43' },
  workspaceActionButton: { minWidth: 74, backgroundColor: '#25564d' },
  fileActionText: { color: '#cffff2', fontSize: 11, fontWeight: '700' },
  deleteActionButton: { backgroundColor: '#3c292b' },
  deleteActionText: { color: '#ffc6c6' },
  emptyFilesText: { color: '#b0b8c4', paddingVertical: 20, textAlign: 'center', lineHeight: 21 },
  storageNote: { color: '#87959e', fontSize: 11, lineHeight: 16, marginTop: 12 },
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
