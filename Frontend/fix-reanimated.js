// Check and fix react-native-reanimated version mismatch
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

console.log('🔍 Checking for React Native Reanimated version mismatch...');

try {
  // Get the installed version from node_modules
  const packageJsonPath = path.join(__dirname, 'node_modules', 'react-native-reanimated', 'package.json');
  const reanimatedPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const installedVersion = reanimatedPackage.version;

  console.log(`✅ React Native Reanimated version installed: ${installedVersion}`);
  
  // Check the version in package.json
  const projectPackagePath = path.join(__dirname, 'package.json');
  const projectPackage = JSON.parse(fs.readFileSync(projectPackagePath, 'utf8'));
  const declaredVersion = projectPackage.dependencies['react-native-reanimated'].replace('^', '').replace('~', '');
  
  console.log(`📄 React Native Reanimated version in package.json: ${declaredVersion}`);
  
  if (installedVersion !== declaredVersion) {
    console.log(`⚠️ Version mismatch detected! Fixing by installing the correct version...`);
    
    // Run npm install with the exact version
    const installCommand = `npm install react-native-reanimated@${installedVersion} --save-exact`;
    console.log(`🔧 Running: ${installCommand}`);
    
    childProcess.execSync(installCommand, { stdio: 'inherit' });
    
    console.log(`🎉 Fixed! Now both versions are ${installedVersion}`);
  } else {
    console.log('✅ Versions match. No action needed.');
  }
  
  console.log('\n🔔 Remember to rebuild your app after making these changes:');
  console.log('- For Expo: expo start -c');
  console.log('- For React Native CLI: npx react-native start --reset-cache\n');
  
} catch (error) {
  console.error('❌ Error checking versions:', error);
}
