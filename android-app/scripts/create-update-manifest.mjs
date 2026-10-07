import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);

export function createUpdateManifest({ appConfig, repository, runNumber, apkSizeBytes }) {
  if (!appConfig?.android?.package || !appConfig?.version || !Number.isSafeInteger(appConfig?.android?.versionCode)) {
    throw new Error('Konfigurasi Expo harus memiliki version, android.package, dan android.versionCode.');
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) {
    throw new Error('GITHUB_REPOSITORY tidak valid.');
  }
  if (!/^\d+$/.test(String(runNumber ?? '')) || !Number.isSafeInteger(apkSizeBytes) || apkSizeBytes <= 0) {
    throw new Error('Nomor rilis atau ukuran APK tidak valid.');
  }

  const releaseTag = `apk-${runNumber}`;
  return {
    schemaVersion: 1,
    appId: appConfig.android.package,
    versionName: appConfig.version,
    versionCode: appConfig.android.versionCode,
    releaseTag,
    apkSizeBytes,
    apkUrl: `https://github.com/${repository}/releases/download/${releaseTag}/app-release.apk`,
  };
}

async function main() {
  const outputPath = resolve(process.cwd(), process.argv[2] ?? 'release/update.json');
  const apkPath = resolve(dirname(outputPath), 'app-release.apk');
  const appConfigPath = resolve(dirname(scriptPath), '../app.json');
  const { expo } = JSON.parse(await readFile(appConfigPath, 'utf8'));
  const manifest = createUpdateManifest({
    appConfig: expo,
    repository: process.env.GITHUB_REPOSITORY,
    runNumber: process.env.GITHUB_RUN_NUMBER,
    apkSizeBytes: (await stat(apkPath)).size,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Generated ${outputPath} for ${manifest.versionName} (${manifest.versionCode}).`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(scriptPath).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
