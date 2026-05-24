/**
 * electron-builder afterSign hook — notarizes the .app with Apple.
 *
 * Two ways to authenticate (in priority order):
 *
 *   1) Keychain profile (recommended for local dev)
 *      One-time setup:
 *        xcrun notarytool store-credentials "li-notary" \
 *          --apple-id you@email.com --team-id XXXXXXXXXX --password xxxx-xxxx-xxxx-xxxx
 *      Override the profile name with the NOTARY_KEYCHAIN_PROFILE env var.
 *
 *   2) Environment variables (recommended for CI)
 *        APPLE_ID                     your Apple ID email
 *        APPLE_APP_SPECIFIC_PASSWORD  app-specific password from appleid.apple.com
 *        APPLE_TEAM_ID                10-character Team ID from developer.apple.com/account
 *
 * If neither is configured, notarization is skipped with a warning (build still succeeds).
 * Only runs on macOS.
 */

export default async function notarize(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') return;

  const { notarize } = await import('@electron/notarize');

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  const keychainProfile =
    process.env.NOTARY_KEYCHAIN_PROFILE || 'li-notary';
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;

  // Prefer keychain profile if it exists; fall back to env vars.
  const hasKeychainProfile = await keychainProfileExists(keychainProfile);

  let auth;
  if (hasKeychainProfile) {
    console.log(`[notarize] Using keychain profile "${keychainProfile}"`);
    auth = { keychainProfile };
  } else if (APPLE_ID && APPLE_APP_SPECIFIC_PASSWORD && APPLE_TEAM_ID) {
    console.log('[notarize] Using APPLE_ID / APPLE_TEAM_ID env vars');
    auth = {
      appleId: APPLE_ID,
      appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
      teamId: APPLE_TEAM_ID,
    };
  } else {
    console.warn(
      `[notarize] Skipping — no keychain profile "${keychainProfile}" and ` +
        'APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID env vars not set.'
    );
    return;
  }

  console.log(`[notarize] Submitting ${appName}.app to Apple notary service…`);

  await notarize({
    tool: 'notarytool',
    appPath,
    ...auth,
  });

  console.log('[notarize] Done ✓');
}

async function keychainProfileExists(profileName) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    // `notarytool history` succeeds (exit 0) only if the profile resolves to valid creds.
    const child = spawn(
      'xcrun',
      ['notarytool', 'history', '--keychain-profile', profileName],
      { stdio: 'ignore' }
    );
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}
