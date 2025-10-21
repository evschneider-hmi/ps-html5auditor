/**
 * Vendor classification utilities for VAST tracking URLs
 */

export function classifyVendor(url: string): { vendor: string; host: string } {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    
    // Innovid
    if (host.includes('innovid.com')) {
      return { vendor: 'Innovid', host };
    }
    
    // DoubleVerify
    if (host.includes('doubleverify.com') || host.includes('doubleclickbygoogle.net')) {
      return { vendor: 'DoubleVerify', host };
    }
    
    // Flashtalking
    if (host.includes('flashtalking.com') || host.includes('secure-ds.serving-sys.com')) {
      return { vendor: 'Flashtalking', host };
    }
    
    // Sizmek (now Amazon)
    if (host.includes('sizmek.com') || host.includes('serving-sys.com')) {
      return { vendor: 'Sizmek', host };
    }
    
    // Google/CM360/DV360
    if (host.includes('doubleclick.net') || host.includes('google.com') || host.includes('googlesyndication.com')) {
      return { vendor: 'Google', host };
    }
    
    // IAS
    if (host.includes('adsafeprotected.com') || host.includes('integralads.com')) {
      return { vendor: 'IAS', host };
    }
    
    // Moat
    if (host.includes('moatads.com')) {
      return { vendor: 'Moat', host };
    }
    
    // Nielsen
    if (host.includes('imrworldwide.com') || host.includes('nielsenonline.com') || host.includes('secure-gl.imrworldwide.com')) {
      return { vendor: 'Nielsen', host };
    }
    
    // Extreme Reach
    if (host.includes('extremereach.com') || host.includes('extremereach.io')) {
      return { vendor: 'Extreme Reach', host };
    }
    
    // Adelaide
    if (host.includes('a47b.com')) {
      return { vendor: 'Adelaide', host };
    }
    
    // Kantar
    if (host.includes('insightexpressai.com')) {
      return { vendor: 'Kantar', host };
    }
    
    // Dynata
    if (host.includes('researchnow.com')) {
      return { vendor: 'Dynata', host };
    }
    
    // Connect (Horizon Next)
    if (host.includes('hrzn-nxt.com')) {
      return { vendor: 'Connect', host };
    }
    
    // LiveRamp
    if (host.includes('rlcdn.com')) {
      return { vendor: 'LiveRamp', host };
    }
    
    // Disqo
    if (host.includes('activemetering.com')) {
      return { vendor: 'Disqo', host };
    }
    
    // Phoenix
    if (host.includes('imtwjwoasak.com')) {
      return { vendor: 'Phoenix', host };
    }
    
    // Upwave
    if (host.includes('surveywall-api.survata.com')) {
      return { vendor: 'Upwave', host };
    }
    
    // Default to host if no match
    return { vendor: host, host };
  } catch {
    return { vendor: 'Unknown', host: '' };
  }
}
