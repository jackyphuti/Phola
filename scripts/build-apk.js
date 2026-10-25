const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 1. Resolve JDK
const userProfile = process.env.USERPROFILE || os.homedir();
const candidateJdks = [
  process.env.JAVA_HOME,
  path.join(userProfile, '.jdks', 'jbr-17.0.14'),
  'C:\\Program Files\\Android\\Android Studio\\jbr',
  'C:\\Program Files\\Java\\jdk-17',
  'C:\\Program Files\\Eclipse Adoptium\\jdk-17'
].filter(Boolean);

let foundJavaHome = candidateJdks.find(dir => {
  const javaBin = path.join(dir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  return fs.existsSync(javaBin);
});

if (foundJavaHome) {
  process.env.JAVA_HOME = foundJavaHome;
  const binDir = path.join(foundJavaHome, 'bin');
  if (!process.env.PATH.includes(binDir)) {
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;
  }
  console.log(`[build:apk] Using JAVA_HOME: ${foundJavaHome}`);
} else {
  console.warn('[build:apk] Warning: No JDK found automatically. Attempting to use system java.');
}

// 2. Resolve Android SDK
const candidateSdks = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(userProfile, 'AppData', 'Local', 'Android', 'Sdk'),
  'C:\\Android\\Sdk'
].filter(Boolean);

let foundAndroidHome = candidateSdks.find(dir => fs.existsSync(dir));
if (foundAndroidHome) {
  process.env.ANDROID_HOME = foundAndroidHome;
  process.env.ANDROID_SDK_ROOT = foundAndroidHome;
  console.log(`[build:apk] Using ANDROID_HOME: ${foundAndroidHome}`);
}

// 3. Sync capacitor
console.log('\n[build:apk] 1/3 Syncing Capacitor Android assets...');
const capCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const syncRes = spawnSync(capCmd, ['cap', 'sync', 'android'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

if (syncRes.status !== 0) {
  console.error('[build:apk] Capacitor sync failed.');
  process.exit(syncRes.status || 1);
}

// 4. Run Gradle assembleDebug
console.log('\n[build:apk] 2/3 Compiling Android debug APK...');
const androidDir = path.join(__dirname, '..', 'android');
const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

const gradleRes = spawnSync(gradlewCmd, ['assembleDebug'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
  env: process.env
});

if (gradleRes.status !== 0) {
  console.error('[build:apk] Gradle assembleDebug failed.');
  process.exit(gradleRes.status || 1);
}

// 5. Copy APK to project root
const builtApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const rootApk = path.join(__dirname, '..', 'phola-debug.apk');

if (fs.existsSync(builtApk)) {
  fs.copyFileSync(builtApk, rootApk);
  const stats = fs.statSync(rootApk);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log('\n============================================================');
  console.log(`[build:apk] SUCCESS! APK created successfully:`);
  console.log(`  Path: ${rootApk}`);
  console.log(`  Size: ${sizeMb} MB`);
  console.log('============================================================\n');
} else {
  console.error(`[build:apk] Built APK not found at: ${builtApk}`);
  process.exit(1);
}
