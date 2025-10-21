import { ParsedVastData } from './types';
import { classifyVendor } from './vendorUtils';

export async function parseVastXml(xmlOrUrl: string): Promise<ParsedVastData> {
  let xmlString = xmlOrUrl.trim();
  let fetchedUrl = '';

  // Check if input is a URL
  if (xmlString.startsWith('http://') || xmlString.startsWith('https://')) {
    fetchedUrl = xmlString;
    try {
      const response = await fetch(xmlString, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch VAST URL: ' + response.statusText);
      xmlString = await response.text();
    } catch (error) {
      return {
        version: '',
        duration: '',
        mediaUrl: '',
        clickThrough: '',
        impressionTrackers: [],
        clickTrackers: [],
        trackingEvents: {},
        vendor: '',
        warnings: [],
        errors: ['Failed to fetch VAST URL: ' + (error as Error).message],
      };
    }
  }

  // Parse XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    errors.push('XML parsing error: ' + parseError.textContent);
    return {
      version: '',
      duration: '',
      mediaUrl: '',
      clickThrough: '',
      impressionTrackers: [],
      clickTrackers: [],
      trackingEvents: {},
      vendor: '',
      warnings,
      errors,
    };
  }

  // Extract VAST version
  const vastElement = xmlDoc.querySelector('VAST');
  const version = vastElement?.getAttribute('version') || '';

  // Extract duration
  let duration = '';
  const durationElement = xmlDoc.querySelector('Duration');
  if (durationElement) {
    const durationText = durationElement.textContent || '';
    duration = parseDuration(durationText);
  } else {
    warnings.push('No duration found in VAST');
  }

  // Extract media URL (highest bitrate MP4)
  let mediaUrl = '';
  const mediaFiles = Array.from(xmlDoc.querySelectorAll('MediaFile'));
  if (mediaFiles.length > 0) {
    const mp4Files = mediaFiles.filter(mf => {
      const type = mf.getAttribute('type') || '';
      return type.includes('mp4');
    });
    
    if (mp4Files.length > 0) {
      // Sort by bitrate descending
      mp4Files.sort((a, b) => {
        const bitrateA = parseInt(a.getAttribute('bitrate') || '0', 10);
        const bitrateB = parseInt(b.getAttribute('bitrate') || '0', 10);
        return bitrateB - bitrateA;
      });
      mediaUrl = mp4Files[0].textContent?.trim() || '';
    } else {
      mediaUrl = mediaFiles[0].textContent?.trim() || '';
    }
  } else {
    warnings.push('No media file found in VAST');
  }

  // Extract ClickThrough
  let clickThrough = '';
  const clickThroughElement = xmlDoc.querySelector('ClickThrough');
  if (clickThroughElement) {
    clickThrough = clickThroughElement.textContent?.trim() || '';
  } else {
    warnings.push('No ClickThrough URL found');
  }

  // Extract impression trackers
  const impressionTrackers: string[] = [];
  const impressionElements = xmlDoc.querySelectorAll('Impression');
  impressionElements.forEach(el => {
    const url = el.textContent?.trim();
    if (url) impressionTrackers.push(url);
  });

  if (impressionTrackers.length === 0) {
    warnings.push('No impression trackers found');
  }

  // Extract click trackers
  const clickTrackers: string[] = [];
  const clickTrackingElements = xmlDoc.querySelectorAll('ClickTracking');
  clickTrackingElements.forEach(el => {
    const url = el.textContent?.trim();
    if (url) clickTrackers.push(url);
  });

  // Extract ALL tracking events from <TrackingEvents>
  const trackingEvents: Record<string, string[]> = {};
  const trackingElements = xmlDoc.querySelectorAll('Tracking');
  trackingElements.forEach(el => {
    const eventType = el.getAttribute('event');
    const url = el.textContent?.trim();
    if (eventType && url) {
      if (!trackingEvents[eventType]) {
        trackingEvents[eventType] = [];
      }
      trackingEvents[eventType].push(url);
    }
  });

  // Detect vendor from URL or trackers
  let vendor = '';
  if (fetchedUrl) {
    vendor = classifyVendor(fetchedUrl);
  }
  if (!vendor || vendor === 'Unknown') {
    // Try to detect from impression trackers
    for (const tracker of impressionTrackers) {
      const detectedVendor = classifyVendor(tracker);
      if (detectedVendor && detectedVendor !== 'Unknown') {
        vendor = detectedVendor;
        break;
      }
    }
  }

  return {
    version,
    duration,
    mediaUrl,
    clickThrough,
    impressionTrackers,
    clickTrackers,
    trackingEvents,
    vendor: vendor || 'Unknown',
    warnings,
    errors,
  };
}

function parseDuration(durationStr: string): string {
  // Duration format: HH:MM:SS or HH:MM:SS.mmm
  const match = durationStr.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return durationStr;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  
  if (totalSeconds >= 60) {
    return Math.floor(totalSeconds / 60) + 'm' + (totalSeconds % 60) + 's';
  }
  return totalSeconds + 's';
}
