const RULES = [
  { id: 'private-key', severity: 'CRITICAL', title: 'Private key material detected', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i },
  { id: 'aws-access-key', severity: 'HIGH', title: 'Possible AWS access key detected', pattern: /AKIA[0-9A-Z]{16}/ },
  { id: 'github-token', severity: 'HIGH', title: 'Possible GitHub token detected', pattern: /gh[pousr]_[A-Za-z0-9_]{30,}/ },
  { id: 'hardcoded-api-key', severity: 'HIGH', title: 'Possible hardcoded API key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i },
  { id: 'hardcoded-secret', severity: 'HIGH', title: 'Possible hardcoded secret', pattern: /(?:client[_-]?secret|secret)\s*[:=]\s*["'][^"'\n]{12,}["']/i },
  { id: 'jwt', severity: 'MEDIUM', title: 'Possible JWT detected', pattern: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { id: 'cleartext-http', severity: 'MEDIUM', title: 'Cleartext HTTP endpoint detected', pattern: /http:\/\/(?!localhost|127\.0\.0\.1|10\.0\.2\.2)/i },
  { id: 'debug-enabled', severity: 'MEDIUM', title: 'Debug indicator detected', pattern: /(?:android:debuggable\s*=\s*["']true|BuildConfig\.DEBUG|debug\s*=\s*true)/i },
  { id: 'widevine', severity: 'INFO', title: 'Widevine indicator', pattern: /(?:widevine|C\.WIDEVINE|WIDEVINE_UUID)/i, tag: 'DRM' },
  { id: 'media-drm', severity: 'INFO', title: 'Android MediaDrm indicator', pattern: /(?:MediaDrm|DrmSession|DefaultDrmSessionManager|ExoMediaDrm)/i, tag: 'DRM' },
  { id: 'license-server', severity: 'INFO', title: 'DRM license-server indicator', pattern: /(?:licenseServer|license[_-]?(?:url|server)|setLicenseUrl|keyRequest)/i, tag: 'DRM' },
  { id: 'offline-license', severity: 'INFO', title: 'Offline DRM license indicator', pattern: /(?:offlineLicense|keySetId|restoreKeys|provideKeyResponse)/i, tag: 'DRM' },
  { id: 'play-integrity', severity: 'INFO', title: 'Play Integrity indicator', pattern: /(?:PlayIntegrity|IntegrityManager|requestIntegrityToken|IntegrityTokenRequest)/i, tag: 'INTEGRITY' },
  { id: 'safetynet', severity: 'INFO', title: 'SafetyNet indicator', pattern: /(?:SafetyNet|attest\s*\()/i, tag: 'INTEGRITY' },
  { id: 'android-keystore', severity: 'INFO', title: 'Android Keystore indicator', pattern: /(?:AndroidKeyStore|KeyGenParameterSpec|KeyStore\.getInstance)/i, tag: 'KEYSTORE' },
  { id: 'root-detection', severity: 'INFO', title: 'Root-detection indicator', pattern: /(?:RootBeer|isRooted|test-keys|\/system\/xbin\/su)/i, tag: 'RUNTIME' },
  { id: 'debugger-detection', severity: 'INFO', title: 'Debugger-detection indicator', pattern: /(?:Debug\.isDebuggerConnected|ptrace|TracerPid)/i, tag: 'RUNTIME' }
];
module.exports = { RULES };
