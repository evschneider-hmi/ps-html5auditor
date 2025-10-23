export function classifyVendor(url: string): string {
  if (!url) return 'Unknown';
  
  const urlLower = url.toLowerCase();
  
  // Primary vendors
  if (urlLower.includes('doubleclick.net') || urlLower.includes('googlesyndication.com') || 
      urlLower.includes('2mdn.net') || urlLower.includes('.g.doubleclick.net') ||
      urlLower.includes('ad.doubleclick.net')) return 'CM360';
  if (urlLower.includes('innovid.com')) return 'Innovid';
  if (urlLower.includes('doubleverify.com') || urlLower.includes('dvtps.com')) return 'DoubleVerify';
  if (urlLower.includes('flashtalking.com')) return 'Flashtalking';
  if (urlLower.includes('sizmek.com') || urlLower.includes('serving-sys.com')) return 'Sizmek';
  if (urlLower.includes('adform.net')) return 'Adform';
  if (urlLower.includes('adsafeprotected.com') || urlLower.includes('iasds01.com')) return 'IAS';
  if (urlLower.includes('moatads.com')) return 'Moat';
  if (urlLower.includes('spotxchange.com') || urlLower.includes('spotx.tv')) return 'SpotX';
  if (urlLower.includes('freewheel.tv')) return 'Freewheel';
  if (urlLower.includes('teads.tv') || urlLower.includes('teads.com')) return 'Teads';
  if (urlLower.includes('truex.com')) return 'true[X]';
  if (urlLower.includes('extreme-ip-lookup.com')) return 'Extreme Reach';
  if (urlLower.includes('tubemogul.com')) return 'TubeMogul';
  if (urlLower.includes('videoplaza.com')) return 'Videoplaza';
  
  // Extract domain
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    return hostname;
  } catch {
    return 'Unknown';
  }
}

export function extractHost(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

export function extractVendorsFromTrackers(trackers: string[]): string[] {
  const vendors = new Set<string>();
  trackers.forEach(url => {
    const vendor = classifyVendor(url);
    if (vendor && vendor !== 'Unknown') {
      vendors.add(vendor);
    }
  });
  return Array.from(vendors);
}
