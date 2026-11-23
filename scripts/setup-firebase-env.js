/**
 * Automatically creates android/app/google-services.json and
 * ios/App/App/GoogleService-Info.plist from environment variables if not present.
 */
const fs = require('fs');
const path = require('path');

const androidPath = path.join(__dirname, '..', 'android', 'app', 'google-services.json');
const iosPath = path.join(__dirname, '..', 'ios', 'App', 'App', 'GoogleService-Info.plist');
const sourcesPath = path.join(__dirname, '..', 'Sources', 'Phola', 'GoogleService-Info.plist');

const projectNumber = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '685813462495';
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'phola-a8741';
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'phola-a8741.firebasestorage.app';

const androidApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY_ANDROID;
const androidAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID_ANDROID || '1:685813462495:android:0be6c1bf7adab322b3c06a';

const iosApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY_IOS;
const iosAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID_IOS || '1:685813462495:ios:7b7fff580dde9e84b3c06a';

if (!fs.existsSync(androidPath) && androidApiKey) {
  const jsonContent = {
    project_info: {
      project_number: projectNumber,
      project_id: projectId,
      storage_bucket: storageBucket,
    },
    client: [
      {
        client_info: {
          mobilesdk_app_id: androidAppId,
          android_client_info: { package_name: 'com.phola.phola' },
        },
        oauth_client: [],
        api_key: [{ current_key: androidApiKey }],
        services: { appinvite_service: { other_platform_oauth_client: [] } },
      },
    ],
    configuration_version: '1',
  };
  fs.mkdirSync(path.dirname(androidPath), { recursive: true });
  fs.writeFileSync(androidPath, JSON.stringify(jsonContent, null, 2), 'utf8');
  console.log('[setup-firebase-env] Generated android/app/google-services.json from env');
}

if (!fs.existsSync(iosPath) && iosApiKey) {
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>API_KEY</key>
	<string>${iosApiKey}</string>
	<key>GCM_SENDER_ID</key>
	<string>${projectNumber}</string>
	<key>PLIST_VERSION</key>
	<string>1</string>
	<key>BUNDLE_ID</key>
	<string>com.phola.phola</string>
	<key>PROJECT_ID</key>
	<string>${projectId}</string>
	<key>STORAGE_BUCKET</key>
	<string>${storageBucket}</string>
	<key>IS_ADS_ENABLED</key>
	<false></false>
	<key>IS_ANALYTICS_ENABLED</key>
	<false></false>
	<key>IS_APPINVITE_ENABLED</key>
	<true></true>
	<key>IS_GCM_ENABLED</key>
	<true></true>
	<key>IS_SIGNIN_ENABLED</key>
	<true></true>
	<key>GOOGLE_APP_ID</key>
	<string>${iosAppId}</string>
</dict>
</plist>`;
  fs.mkdirSync(path.dirname(iosPath), { recursive: true });
  fs.writeFileSync(iosPath, plistContent, 'utf8');
  if (fs.existsSync(path.dirname(sourcesPath))) {
    fs.writeFileSync(sourcesPath, plistContent, 'utf8');
  }
  console.log('[setup-firebase-env] Generated ios/App/App/GoogleService-Info.plist from env');
}
