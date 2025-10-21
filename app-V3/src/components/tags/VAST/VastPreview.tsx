import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { VastEntry, ParsedVastData } from './types';
import { parseVastXml } from './vastParser';
import { classifyVendor } from './vendorMap';

interface VastPreviewProps {
  entry: VastEntry;
}

type EventRow = { time: string; label: string };

type TrackerStatus = 'pending' | 'fired' | 'error';

interface Tracker {
  url: string;
  firedAt?: string;
  status?: TrackerStatus;
}

interface GroupedTracker {
  vendor: string;
  host: string;
  event: string;
  count: number;
  firedCount: number;
  urls: string[];
}

interface PartnerTrackers {
  vendor: string;
  host: string;
  hasImpression: boolean;
  hasClick: boolean;
  impressionCount: number;
  impressionFired: number;
  impressionUrls: string[];
  clickCount: number;
  clickFired: number;
  clickUrls: string[];
  otherEvents: {
    event: string;
    count: number;
    firedCount: number;
    urls: string[];
  }[];
  errorHandlingEvents: {
    event: string;
    count: number;
    firedCount: number;
    urls: string[];
  }[];
  totalEvents: number;
}

const Step: React.FC<{ label: string; done?: boolean; hint?: string }> = ({ label, done, hint }) => (
  <div
    title={hint}
    style={{
      padding: '6px 8px',
      borderRadius: 6,
      background: done ? 'var(--ok, #22c55e)' : 'var(--btn-bg, #f3f4f6)',
      color: done ? '#fff' : 'var(--text, #1f2937)',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: 700,
      border: '1px solid',
      borderColor: done ? 'transparent' : 'var(--btn-border, #d1d5db)',
    }}
  >
    {label}
  </div>
);

function timeNow(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}:${String(now.getMilliseconds()).padStart(3, '0')}`;
}

function appendCb(u: string): string {
  try {
    const x = new URL(u);
    x.searchParams.set('cb', String(Date.now()));
    return x.toString();
  } catch {
    return u + (u.includes('?') ? '&' : '?') + 'cb=' + Date.now();
  }
}

export function VastPreview({ entry }: VastPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const [vastData, setVastData] = useState<ParsedVastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Playback state
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [audioToggled, setAudioToggled] = useState(false);
  const [quartilesDone, setQuartilesDone] = useState({
    q25: false,
    q50: false,
    q75: false,
    complete: false,
  });
  
  // Tracking state
  const [requestStart, setRequestStart] = useState<number | undefined>(undefined);
  const [impressionTime, setImpressionTime] = useState<number | undefined>(undefined);
  const [timeline, setTimeline] = useState<EventRow[]>([]);
  const [trackers, setTrackers] = useState<Record<string, Tracker[]>>({});
  const [duration, setDuration] = useState<number | undefined>(undefined);
  
  // Expandable tracker rows
  const [expandedTrackers, setExpandedTrackers] = useState<Set<string>>(new Set());
  
  // Load VAST XML and parse
  useEffect(() => {
    let cancelled = false;
    
    async function load() {
      try {
        setLoading(true);
        setError(null);
        setRequestStart(performance.now());
        
        const data = await parseVastXml(entry.vastUrl);
        
        if (cancelled) return;
        
        if (data.errors.length > 0) {
          setError(data.errors.join('; '));
        }
        
        setVastData(data);
        
        // Build tracker structure from parsed VAST data
        const trackersMap: Record<string, Tracker[]> = {};
        
        // Error trackers
        if (data.errorTrackers.length > 0) {
          trackersMap.error = data.errorTrackers.map(url => ({ url }));
        }
        
        // Impression trackers
        if (data.impressionTrackers.length > 0) {
          trackersMap.impression = data.impressionTrackers.map(url => ({ url }));
        }
        
        // Click trackers
        if (data.clickTrackers.length > 0) {
          trackersMap.click = data.clickTrackers.map(url => ({ url }));
        }
        
        // Add ALL tracking events from VAST
        Object.entries(data.trackingEvents).forEach(([eventName, urls]) => {
          trackersMap[eventName] = urls.map(url => ({ url }));
        });
        
        setTrackers(trackersMap);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load VAST');
          setLoading(false);
        }
      }
    }
    
    load();
    
    return () => {
      cancelled = true;
    };
  }, [entry.vastUrl]);
  
  // Log event to timeline
  const log = (label: string) => {
    setTimeline(prev => [...prev, { time: timeNow(), label }]);
  };
  
  // Fire tracking pixels
  const fireEvent = (eventName: string) => {
    const eventTrackers = trackers[eventName];
    if (!eventTrackers || eventTrackers.length === 0) return;
    
    const ts = timeNow();
    
    // Update tracker status
    setTrackers(prev => ({
      ...prev,
      [eventName]: prev[eventName]?.map(t =>
        t.firedAt ? t : { ...t, firedAt: ts, status: 'fired' as TrackerStatus }
      ) || [],
    }));
    
    // Fire pixels
    eventTrackers.forEach(t => {
      try {
        const img = new Image();
        img.src = appendCb(t.url);
      } catch {}
    });
  };
  
  // Video event handlers
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    
    let q25 = false, q50 = false, q75 = false, comp = false;
    
    function onPlay() {
      if (!started) {
        setStarted(true);
        log('started');
        fireEvent('start');
      }
    }
    
    function onPlaying() {
      if (!impressionTime && requestStart !== undefined) {
        setImpressionTime(performance.now());
        log('impression');
        fireEvent('impression');
        fireEvent('creativeView');
      }
    }
    
    function onPause() {
      setPaused(true);
      log('pause');
      fireEvent('pause');
    }
    
    function onEnded() {
      comp = true;
      setQuartilesDone(s => ({ ...s, complete: true }));
      log('complete');
      fireEvent('complete');
    }
    
    function onTime() {
      if (!v) return;
      try {
        const d = duration || v.duration || 0;
        const t = v.currentTime;
        
        if (!q25 && d > 0 && t >= d * 0.25) {
          q25 = true;
          setQuartilesDone(s => ({ ...s, q25: true }));
          log('firstQuartile');
          fireEvent('firstQuartile');
        }
        
        if (!q50 && d > 0 && t >= d * 0.5) {
          q50 = true;
          setQuartilesDone(s => ({ ...s, q50: true }));
          log('midpoint');
          fireEvent('midpoint');
        }
        
        if (!q75 && d > 0 && t >= d * 0.75) {
          q75 = true;
          setQuartilesDone(s => ({ ...s, q75: true }));
          log('thirdQuartile');
          fireEvent('thirdQuartile');
        }
      } catch {}
    }
    
    function onVolumeChange() {
      if (!v || !audioToggled) return;
      setAudioToggled(true);
      log(v.muted ? 'mute' : 'unmute');
      fireEvent(v.muted ? 'mute' : 'unmute');
    }
    
    v.addEventListener('play', onPlay);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('volumechange', onVolumeChange);
    
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('volumechange', onVolumeChange);
    };
  }, [duration, started, impressionTime, requestStart]);
  
  // Calculate response time
  const responseMs = useMemo(() => 
    (requestStart !== undefined && impressionTime !== undefined) 
      ? Math.round(impressionTime - requestStart)
      : undefined,
    [requestStart, impressionTime]
  );
  
  // Group trackers by partner with high-level impression/click summary
  const partnerTrackers = useMemo(() => {
    const partners: PartnerTrackers[] = [];
    const vendorMap = new Map<string, {
      host: string;
      events: Map<string, { count: number; firedCount: number; urls: string[] }>;
      errorHandlingEvents: Map<string, { count: number; firedCount: number; urls: string[] }>;
    }>();
    
    // Group all trackers by vendor FIRST (each URL classified to its own vendor)
    Object.entries(trackers).forEach(([event, trackerList]) => {
      trackerList.forEach(t => {
        const classification = classifyVendor(t.url);
        const { vendor, host, isErrorHandling } = classification;
        
        // Initialize vendor if not exists
        if (!vendorMap.has(vendor)) {
          vendorMap.set(vendor, {
            host,
            events: new Map(),
            errorHandlingEvents: new Map(),
          });
        }
        
        const vendorData = vendorMap.get(vendor)!;
        
        // Determine which event map to use (error handling vs regular)
        const targetMap = isErrorHandling ? vendorData.errorHandlingEvents : vendorData.events;
        
        // Initialize event for this vendor if not exists
        if (!targetMap.has(event)) {
          targetMap.set(event, { count: 0, firedCount: 0, urls: [] });
        }
        
        const stats = targetMap.get(event)!;
        stats.count++;
        stats.urls.push(t.url);
        if (t.firedAt) stats.firedCount++;
      });
    });
    
    // Build partner summary with impression/click highlighted
    vendorMap.forEach((vendorData, vendor) => {
      const impression = vendorData.events.get('impression');
      const click = vendorData.events.get('click');
      
      const otherEvents: PartnerTrackers['otherEvents'] = [];
      const errorHandlingEvents: PartnerTrackers['errorHandlingEvents'] = [];
      let totalEvents = 0;
      
      vendorData.events.forEach((stats, event) => {
        totalEvents++;
        // Skip impression/click from "other" since we show them separately
        if (event !== 'impression' && event !== 'click') {
          otherEvents.push({
            event,
            count: stats.count,
            firedCount: stats.firedCount,
            urls: stats.urls,
          });
        }
      });
      
      // Add error handling events
      vendorData.errorHandlingEvents.forEach((stats, event) => {
        totalEvents++;
        errorHandlingEvents.push({
          event,
          count: stats.count,
          firedCount: stats.firedCount,
          urls: stats.urls,
        });
      });
      
      partners.push({
        vendor,
        host: vendorData.host,
        hasImpression: !!impression,
        hasClick: !!click,
        impressionCount: impression?.count || 0,
        impressionFired: impression?.firedCount || 0,
        impressionUrls: impression?.urls || [],
        clickCount: click?.count || 0,
        clickFired: click?.firedCount || 0,
        clickUrls: click?.urls || [],
        otherEvents: otherEvents.sort((a, b) => a.event.localeCompare(b.event)),
        errorHandlingEvents: errorHandlingEvents.sort((a, b) => a.event.localeCompare(b.event)),
        totalEvents,
      });
    });
    
    return partners.sort((a, b) => a.vendor.localeCompare(b.vendor));
  }, [trackers]);
  
  const handleVideoClick = () => {
    if (vastData?.clickThrough) {
      window.open(vastData.clickThrough, '_blank', 'noopener');
      setClicked(true);
      log('click');
      fireEvent('click');
    }
  };
  
  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading VAST...
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ padding: 20, color: 'var(--error, #ef4444)' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Error Loading VAST</div>
        <div style={{ fontSize: 14 }}>{error}</div>
      </div>
    );
  }
  
  if (!vastData) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
        No VAST data available
      </div>
    );
  }
  
  const th: React.CSSProperties = {
    background: 'var(--table-head, #f9fafb)',
    textAlign: 'left',
    padding: 6,
    whiteSpace: 'nowrap',
  };
  
  const td: React.CSSProperties = { padding: 6, verticalAlign: 'top' };
  
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
      {/* Two-column layout: Video LEFT, Metrics RIGHT (like V2) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* LEFT COLUMN: Video Player */}
        <div>
            {/* Info Section */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Info</div>
              <ul style={{
                fontFamily: 'monospace',
                fontSize: 11,
                background: 'var(--surface-2, #f3f4f6)',
                color: 'var(--text)',
                padding: 6,
                borderRadius: 6,
                border: '1px solid var(--border, #e5e7eb)',
                margin: 0,
                listStyle: 'none',
              }}>
                <li>VAST Version: {vastData.version}</li>
                <li>Duration: {vastData.duration}</li>
                <li>Vendor: {vastData.vendor}</li>
                {vastData.adId && <li>Ad ID: {vastData.adId}</li>}
                {vastData.creativeId && <li>Creative ID: {vastData.creativeId}</li>}
                {vastData.adTitle && <li>Ad Title: {vastData.adTitle}</li>}
                {vastData.adSystem && <li>Ad System: {vastData.adSystem}</li>}
                <li>Impressions: {vastData.impressionTrackers.length}</li>
                <li>Click Trackers: {vastData.clickTrackers.length}</li>
                {vastData.errorTrackers.length > 0 && <li>Error Trackers: {vastData.errorTrackers.length}</li>}
              </ul>
            </div>
            
            {/* Video Player */}
            {vastData.mediaUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={vastData.mediaUrl}
                  controls
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    border: '1px solid var(--border, #e5e7eb)',
                    borderRadius: 6,
                    cursor: vastData.clickThrough ? 'pointer' : 'default',
                  }}
                  onClick={handleVideoClick}
                  onCanPlay={() => {
                    try {
                      videoRef.current?.play().catch(() => {});
                    } catch {}
                  }}
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (v.duration) setDuration(v.duration);
                  }}
                />
                
                {vastData.clickThrough && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={handleVideoClick}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: 'none',
                        background: 'var(--primary, #3b82f6)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Open ClickThrough
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                padding: 40,
                textAlign: 'center',
                border: '2px dashed var(--border, #e5e7eb)',
                borderRadius: 6,
                color: 'var(--text-secondary, #6b7280)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No Video Available</div>
                <div style={{ fontSize: 12 }}>VAST XML parsed but no MediaFile URL found</div>
              </div>
            )}
          </div>
          
          {/* RIGHT COLUMN: Metrics (Progress, Events, Trackers) */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Progression
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12 }}>
              <Step label="request" done={requestStart !== undefined} />
              <Step label="impression" done={impressionTime !== undefined} hint={responseMs ? `${responseMs} ms` : undefined} />
              <Step label="started" done={started} />
              <Step label="25%" done={quartilesDone.q25} />
              <Step label="50%" done={quartilesDone.q50} />
              <Step label="75%" done={quartilesDone.q75} />
              <Step label="complete" done={quartilesDone.complete} />
              <Step label="pause" done={paused} />
              <Step label="audio toggle" done={audioToggled} />
              <Step label="click" done={clicked} />
            </div>
            
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 12 }}>Events</div>
            <div style={{
              maxHeight: 200,
              overflow: 'auto',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 6,
              background: 'var(--surface, #fff)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--table-head, #f9fafb)' }}>
                    <th style={th}>Time</th>
                    <th style={th}>Event</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border, #e5e7eb)' }}>
                      <td style={td}>{row.time}</td>
                      <td style={td}>{row.label}</td>
                    </tr>
                  ))}
                  {timeline.length === 0 && (
                    <tr>
                      <td style={td} colSpan={2}>(no events yet)</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 12 }}>Trackers</div>
            <div style={{
              maxHeight: 400,
              overflow: 'auto',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 6,
              background: 'var(--surface, #fff)',
              marginTop: 8,
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--table-head, #f9fafb)' }}>
                    <th style={{ ...th, width: 30 }}></th>
                    <th style={th}>Partner</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerTrackers.length === 0 ? (
                    <tr>
                      <td style={td} colSpan={3}>(none)</td>
                    </tr>
                  ) : (
                    partnerTrackers.map((partner, i) => {
                      const partnerId = partner.vendor;
                      const isExpanded = expandedTrackers.has(partnerId);
                      
                      // Calculate total tracker count
                      const totalTrackers = partner.impressionCount + partner.clickCount + 
                        partner.otherEvents.reduce((sum, evt) => sum + evt.count, 0);
                      
                      // Helper to get event label with clarifications
                      const getEventLabel = (event: string): { label: string; tooltip?: string } => {
                        // Innovid-specific clarifications
                        if (partner.vendor === 'Innovid') {
                          if (event === 'impression' || event === 'creativeView') {
                            // Check if this is actually the 'init' call
                            const url = partner.otherEvents.find(e => e.event === event)?.urls[0] || '';
                            if (url.includes('action=init')) {
                              return {
                                label: 'Initialization',
                                tooltip: 'Innovid initialization pixel - fires when VAST is loaded',
                              };
                            }
                            if (url.includes('/uuid')) {
                              return {
                                label: 'UUID Assignment',
                                tooltip: 'Innovid UUID assignment - assigns unique ID for this impression',
                              };
                            }
                          }
                        }
                        
                        // Default event labels
                        const labels: Record<string, { label: string; tooltip?: string }> = {
                          impression: { label: 'Impression', tooltip: 'VAST impression tracking pixel' },
                          creativeView: { label: 'Impression', tooltip: 'VAST impression tracking pixel' },
                          click: { label: 'Click', tooltip: 'User clicked on the video ad' },
                          start: { label: 'Start', tooltip: 'Video playback started' },
                          firstQuartile: { label: 'First Quartile (25%)', tooltip: 'Video reached 25% completion' },
                          midpoint: { label: 'Midpoint (50%)', tooltip: 'Video reached 50% completion' },
                          thirdQuartile: { label: 'Third Quartile (75%)', tooltip: 'Video reached 75% completion' },
                          complete: { label: 'Complete', tooltip: 'Video playback completed' },
                          pause: { label: 'Pause', tooltip: 'Video was paused' },
                          resume: { label: 'Resume', tooltip: 'Video playback resumed' },
                          mute: { label: 'Mute', tooltip: 'Video was muted' },
                          unmute: { label: 'Unmute', tooltip: 'Video was unmuted' },
                          error: { 
                            label: 'Error', 
                            tooltip: 'Error tracker - fires only if VAST playback fails (not an active error)' 
                          },
                          verificationNotExecuted: { 
                            label: 'Verification Not Executed', 
                            tooltip: 'OMID verification script failed to execute' 
                          },
                        };
                        
                        return labels[event] || { label: event };
                      };
                      
                      // Get display name for partner
                      const getPartnerDisplayName = (vendor: string): string => {
                        if (vendor === 'Google') return 'CM360';
                        return vendor;
                      };
                      
                      // Build ordered list of all events (impression, click, then others in specific order, then error handling)
                      const orderedEvents: Array<{
                        event: string;
                        count: number;
                        firedCount: number;
                        urls: string[];
                        isErrorHandling?: boolean;
                      }> = [];
                      
                      // Define event order
                      const eventOrder = [
                        'impression',
                        'creativeView', 
                        'click',
                        'start',
                        'firstQuartile',
                        'midpoint',
                        'thirdQuartile',
                        'complete',
                        'pause',
                        'resume',
                        'mute',
                        'unmute',
                        'error',
                        'verificationNotExecuted',
                      ];
                      
                      // Add impression if present
                      if (partner.hasImpression) {
                        orderedEvents.push({
                          event: 'impression',
                          count: partner.impressionCount,
                          firedCount: partner.impressionFired,
                          urls: partner.impressionUrls,
                        });
                      }
                      
                      // Add click if present
                      if (partner.hasClick) {
                        orderedEvents.push({
                          event: 'click',
                          count: partner.clickCount,
                          firedCount: partner.clickFired,
                          urls: partner.clickUrls,
                        });
                      }
                      
                      // Add other events in order
                      eventOrder.forEach(eventName => {
                        const evt = partner.otherEvents.find(e => e.event === eventName);
                        if (evt && eventName !== 'creativeView') { // Skip creativeView as it's same as impression
                          orderedEvents.push(evt);
                        }
                      });
                      
                      // Add any remaining events not in the order
                      partner.otherEvents.forEach(evt => {
                        if (!eventOrder.includes(evt.event) && !orderedEvents.find(e => e.event === evt.event)) {
                          orderedEvents.push(evt);
                        }
                      });
                      
                      // Add error handling events at the end
                      if (partner.errorHandlingEvents.length > 0) {
                        partner.errorHandlingEvents.forEach(evt => {
                          orderedEvents.push({
                            ...evt,
                            isErrorHandling: true,
                          });
                        });
                      }
                      
                      return (
                        <React.Fragment key={i}>
                          {/* Partner Summary Row */}
                          <tr 
                            style={{ 
                              borderTop: '1px solid var(--border, #e5e7eb)',
                              cursor: 'pointer',
                              background: isExpanded ? 'var(--surface-2, #f9fafb)' : 'transparent',
                            }}
                            onClick={() => {
                              setExpandedTrackers(prev => {
                                const next = new Set(prev);
                                if (next.has(partnerId)) {
                                  next.delete(partnerId);
                                } else {
                                  next.add(partnerId);
                                }
                                return next;
                              });
                            }}
                          >
                            <td style={{ ...td, textAlign: 'center', fontSize: 16 }}>
                              <span style={{ 
                                display: 'inline-block',
                                transition: 'transform 0.2s',
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              }}>
                                ›
                              </span>
                            </td>
                            <td style={{ ...td, fontWeight: 600 }}>
                              {getPartnerDisplayName(partner.vendor)}
                              <span style={{ 
                                marginLeft: 6, 
                                color: 'var(--text-secondary, #999)',
                                fontWeight: 400,
                                fontSize: 11,
                              }}>
                                ({totalTrackers})
                              </span>
                            </td>
                            <td style={td}>
                              {orderedEvents.some(e => e.firedCount > 0) ? (
                                <span style={{ color: 'var(--ok, #22c55e)', fontWeight: 600 }}>
                                  ✓ {orderedEvents.reduce((sum, e) => sum + e.firedCount, 0)}/
                                  {orderedEvents.reduce((sum, e) => sum + e.count, 0)}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-secondary, #6b7280)' }}>
                                  0/{totalTrackers}
                                </span>
                              )}
                            </td>
                          </tr>
                          
                          {/* Expanded Event Details */}
                          {isExpanded && orderedEvents.map((evt, evtIdx) => {
                            const eventId = `${partnerId}-${evt.event}`;
                            const isEventExpanded = expandedTrackers.has(eventId);
                            const { label, tooltip } = getEventLabel(evt.event);
                            
                            return (
                              <React.Fragment key={evtIdx}>
                                <tr 
                                  style={{ 
                                    background: 'var(--surface-2, #f9fafb)',
                                    cursor: 'pointer',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedTrackers(prev => {
                                      const next = new Set(prev);
                                      if (next.has(eventId)) {
                                        next.delete(eventId);
                                      } else {
                                        next.add(eventId);
                                      }
                                      return next;
                                    });
                                  }}
                                >
                                  <td style={{ ...td, textAlign: 'center', fontSize: 14, paddingLeft: 20 }}>
                                    <span style={{ 
                                      display: 'inline-block',
                                      transition: 'transform 0.2s',
                                      transform: isEventExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    }}>
                                      ›
                                    </span>
                                  </td>
                                  <td 
                                    style={{ ...td, paddingLeft: 24 }} 
                                    title={tooltip}
                                  >
                                    {/* Show "Error Handling" prefix for error handling events */}
                                    {evt.isErrorHandling && (
                                      <span style={{ 
                                        color: 'var(--warning, #f59e0b)', 
                                        fontWeight: 600,
                                        marginRight: 4,
                                      }}>
                                        Error Handling:
                                      </span>
                                    )}
                                    {label}
                                    {evt.event === 'error' && (
                                      <span 
                                        style={{ 
                                          marginLeft: 4, 
                                          fontSize: 10, 
                                          color: 'var(--warning, #f59e0b)',
                                        }}
                                      >
                                        ⚠
                                      </span>
                                    )}
                                  </td>
                                  <td style={td}>
                                    {evt.firedCount > 0 ? (
                                      <span style={{ color: 'var(--ok, #22c55e)', fontWeight: 600 }}>
                                        ✓ {evt.firedCount}/{evt.count}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-secondary, #6b7280)' }}>
                                        {evt.count}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                                
                                {/* Pixel URLs */}
                                {isEventExpanded && evt.urls.map((url, urlIdx) => {
                                  // Detect wrapped/embedded URLs in parameters
                                  const urlObj = (() => { try { return new URL(url); } catch { return null; } })();
                                  const embeddedUrls: string[] = [];
                                  
                                  if (urlObj) {
                                    // Check for common wrapper parameters that contain URLs
                                    ['el', 'url', 'redirect', 'redir', 'r', 'destination', 'dest'].forEach(param => {
                                      const value = urlObj.searchParams.get(param);
                                      if (value) {
                                        try {
                                          // Try to decode and parse as URL
                                          const decoded = decodeURIComponent(value);
                                          if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
                                            embeddedUrls.push(decoded);
                                          }
                                        } catch {}
                                      }
                                    });
                                  }
                                  
                                  return (
                                    <React.Fragment key={`${evtIdx}-url-${urlIdx}`}>
                                      <tr style={{ background: 'var(--surface, #fff)' }}>
                                        <td style={td}></td>
                                        <td style={{ ...td, paddingLeft: 40 }} colSpan={2}>
                                          <div style={{ 
                                            fontFamily: 'monospace', 
                                            fontSize: 11,
                                            wordBreak: 'break-all',
                                            color: 'var(--text-secondary, #6b7280)',
                                            padding: '6px 8px',
                                            background: 'var(--surface-2, #f9fafb)',
                                            border: '1px solid var(--border, #e5e7eb)',
                                            borderRadius: 4,
                                            margin: '2px 0',
                                          }}>
                                            {url}
                                          </div>
                                          
                                          {/* Show embedded/wrapped URLs */}
                                          {embeddedUrls.length > 0 && embeddedUrls.map((embUrl, embIdx) => {
                                            const embHost = (() => { 
                                              try { return new URL(embUrl).hostname; } 
                                              catch { return ''; } 
                                            })();
                                            
                                            return (
                                              <div 
                                                key={embIdx}
                                                style={{
                                                  marginTop: 6,
                                                  paddingLeft: 12,
                                                  borderLeft: '2px solid var(--warning, #f59e0b)',
                                                  fontSize: 10,
                                                }}
                                                title="This URL is embedded in the wrapper's parameters and fires when the wrapper executes"
                                              >
                                                <div style={{ 
                                                  fontWeight: 600, 
                                                  color: 'var(--warning, #f59e0b)',
                                                  marginBottom: 2,
                                                }}>
                                                  ↳ Wrapped: {embHost}
                                                </div>
                                                <div style={{
                                                  fontFamily: 'monospace',
                                                  color: 'var(--text-secondary, #6b7280)',
                                                  wordBreak: 'break-all',
                                                  padding: '4px 6px',
                                                  background: 'var(--surface, #fff)',
                                                  border: '1px dashed var(--warning, #f59e0b)',
                                                  borderRadius: 4,
                                                }}>
                                                  {embUrl}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
    </div>
  );
}
