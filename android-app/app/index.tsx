import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Cache-buster memastikan APK tidak menampilkan HTML Worker lama setelah UI dirilis.
const MAIN_WEB_URL = 'https://c-zipper.corelink-ai.workers.dev/?app_release=apk-9';
const DOWNLOAD_BRIDGE = `
(function () {
  if (window.__CZIPERR_DOWNLOAD_BRIDGE__) return true;
  window.__CZIPERR_DOWNLOAD_BRIDGE__ = true;
  var originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var anchor = this;
    var href = anchor.href || '';
    var name = anchor.download || '';
    if (name && href.indexOf('blob:') === 0 && window.ReactNativeWebView) {
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
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#0e1116' },
  title: { color: '#5ee1c0', fontSize: 24, fontWeight: '700' },
  message: { color: '#b0b8c4', textAlign: 'center', lineHeight: 22, marginTop: 12, marginBottom: 22 },
  button: { backgroundColor: '#2e5c52', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: '#ffffff', fontWeight: '700' },
  link: { color: '#5ee1c0', marginTop: 18, fontWeight: '600' },
});
