/**
 * Creative Metadata Detector Demo
 * Quick test of creative metadata detection with actual SampleZips filenames
 */

import { detectCreativeMetadata, groupCreativeSets, suggestWorkspaceName } from './creativeMetadataDetector';

// Actual filenames from SampleZips
const sampleFiles = [
  // Eylea HD
  '160x600_Eylea HD_Teresa Animated Banners_H5_45_A23_US.EHD.24.11.0015.zip',
  '300x250_Eylea HD_Teresa Animated Banners_H5_45_A23_US.EHD.24.11.0015.zip',
  '300x600_Eylea HD_Teresa Animated Banners_H5_45_A23_US.EHD.24.11.0015.zip',
  '728x90_Eylea HD_Teresa Animated Banners_H5_45_A23_US.EHD.24.11.0015.zip',
  
  // Honda ACC
  'ACC_NEW_Spirit of Honda Value RV2_NSEV_239LL_ENG_160x600_WDCH_H5_NV_SNW_ACC.zip',
  'ACC_NEW_Spirit of Honda Value RV2_NSEV_239LL_ENG_300x250_WDCH_H5_NV_SNW_ACC.zip',
  'ACC_NEW_Spirit of Honda Value RV2_NSEV_239LL_ENG_300x600_WDCH_H5_NV_SNW_ACC.zip',
  'ACC_NEW_Spirit of Honda Value RV2_NSEV_239LL_ENG_728x90_WDCH_H5_NV_SNW_ACC.zip',
  
  // Honda HRV
  'HRV_NEW_Spirit of Honda Value_SPRE_279L_ENG_160x600_WDCH_H5_NV_SNW_HRV.zip',
  'HRV_NEW_Spirit of Honda Value_SPRE_279L_ENG_300x600_WDCH_H5_NV_SNW_HRV.zip',
  'HRV_NEW_Spirit of Honda Value_SPRE_279L_ENG_728x90_WDCH_H5_NV_SNW_HRV.zip',
  'HRV_NEW_National Mobile_NSEV_NOIN_ENG_320x50_WDCH_H5_NV_NCTA_HRV.zip',
  
  // Walden
  'walden_conversion_160x600_animated.zip',
  'walden_conversion_300x250_animated.zip',
  'walden_conversion_300x600_animated.zip',
  'walden_conversion_720x90_animated.zip',
  'walden_conversion_970x250_animated.zip',
  
  // SWO
  'SWO_10-19-25_LOC SDay D-O_HOS_SDT_AL4599_DIS_D-HTML5_160x600_ENG.zip',
  'SWO_10-19-25_LOC SDay D-O_HOS_SDT_AL4599_DIS_D-HTML5_300x250_ENG.zip',
  'SWO_10-19-25_LOC SDay D-O_HOS_SDT_AL4599_DIS_D-HTML5_300x600_ENG.zip',
  'SWO_10-19-25_LOC SDay D-O_HOS_SDT_AL4599_DIS_D-HTML5_728x90_ENG.zip',
  
  // UHCH
  'UHCH_Sept Campaign_OTC Jabra_Display_970x250.zip',
  'UHCH_Sept Campaign_OTC Lexie_Display_970x250.zip',
  
  // Test files
  '160x600_test.zip',
  'Sample HTML5 Leaderboard creative.zip',
];

console.log('=== Creative Metadata Detection Demo ===\n');

// Detect all creative metadata
const creatives = sampleFiles.map(detectCreativeMetadata);

// Show individual detections
console.log('Individual Creative Metadata Detections:');
console.log('-'.repeat(80));
creatives.forEach((creative, i) => {
  console.log(`File: ${sampleFiles[i]}`);
  console.log(`  Brand: ${creative.brand}`);
  console.log(`  Creative Name: ${creative.creativeName}`);
  console.log(`  Size: ${creative.size}`);
  if (creative.variant) {
    console.log(`  Variant: ${creative.variant}`);
  }
  console.log(`  Full Name: ${creative.fullName}`);
  console.log(`  Group Key: ${creative.groupKey}`);
  console.log();
});

// Show groupings
console.log('\n=== Creative Set Groupings ===\n');
const groups = groupCreativeSets(creatives);
console.log(`Total Groups: ${groups.size}\n`);

groups.forEach((group, key) => {
  console.log(`Group: ${key}`);
  console.log(`  Count: ${group.length} creatives`);
  console.log(`  Sizes: ${group.map(c => c.size).join(', ')}`);
  console.log(`  Name: ${group[0].fullName.split(' (')[0]}`);
  console.log();
});

// Show suggested workspace names
console.log('\n=== Suggested Workspace Names ===\n');

// Single creative set (Eylea HD)
const eyleaCreatives = creatives.filter(c => c.brand === 'Eylea HD');
console.log(`Eylea HD creatives (${eyleaCreatives.length}): ${suggestWorkspaceName(eyleaCreatives)}`);

// Single brand, multiple creative sets (Honda)
const hondaCreatives = creatives.filter(c => c.brand === 'Honda');
console.log(`Honda creatives (${hondaCreatives.length}): ${suggestWorkspaceName(hondaCreatives)}`);

// Mixed brands
console.log(`All creatives (${creatives.length}): ${suggestWorkspaceName(creatives)}`);

// Summary stats
console.log('\n=== Summary Stats ===\n');
console.log(`Total Files: ${sampleFiles.length}`);
console.log(`Unique Brands: ${new Set(creatives.map(c => c.brand)).size}`);
console.log(`Unique Creative Sets: ${groups.size}`);
console.log(`Unique Sizes: ${new Set(creatives.map(c => c.size)).size}`);

console.log('\nBrands:');
const brandCounts = new Map<string, number>();
creatives.forEach(c => {
  brandCounts.set(c.brand, (brandCounts.get(c.brand) || 0) + 1);
});
brandCounts.forEach((count, brand) => {
  console.log(`  ${brand}: ${count} creatives`);
});
