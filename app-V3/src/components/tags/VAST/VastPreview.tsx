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
        
        // Also add creativeView if we have impressions
        if (data.impressionTrackers.length > 0) {
          trackersMap.creativeView = data.impressionTrackers.map(url => ({ url }));
        }
        
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
  
  // Group trackers by vendor
  const groupedTrackers = useMemo(() => {
    const groups: GroupedTracker[] = [];
    const vendorMap = new Map<string, Map<string, { count: number; firedCount: number; urls: string[] }>>();
    
    Object.entries(trackers).forEach(([event, trackerList]) => {
      trackerList.forEach(t => {
        const { vendor, host } = classifyVendor(t.url);
        
        if (!vendorMap.has(vendor)) {
          vendorMap.set(vendor, new Map());
        }
        
        const eventMap = vendorMap.get(vendor)!;
        if (!eventMap.has(event)) {
          eventMap.set(event, { count: 0, firedCount: 0, urls: [] });
        }
        
        const stats = eventMap.get(event)!;
        stats.count++;
        stats.urls.push(t.url);
        if (t.firedAt) stats.firedCount++;
      });
    });
    
    vendorMap.forEach((eventMap, vendor) => {
      eventMap.forEach((stats, event) => {
        groups.push({
          vendor,
          host: '',
          event,
          count: stats.count,
          firedCount: stats.firedCount,
          urls: stats.urls,
        });
      });
    });
    
    return groups.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.event.localeCompare(b.event));
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
                <li>Impressions: {vastData.impressionTrackers.length}</li>
                <li>Click Trackers: {vastData.clickTrackers.length}</li>
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
                    <th style={th}>Vendor</th>
                    <th style={th}>Event</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTrackers.length === 0 ? (
                    <tr>
                      <td style={td} colSpan={4}>(none)</td>
                    </tr>
                  ) : (
                    groupedTrackers.map((g, i) => {
                      const trackerId = `${g.vendor}-${g.event}`;
                      const isExpanded = expandedTrackers.has(trackerId);
                      
                      return (
                        <React.Fragment key={i}>
                          <tr 
                            style={{ 
                              borderTop: '1px solid var(--border, #e5e7eb)',
                              cursor: 'pointer',
                              background: isExpanded ? 'var(--surface-2, #f9fafb)' : 'transparent',
                            }}
                            onClick={() => {
                              setExpandedTrackers(prev => {
                                const next = new Set(prev);
                                if (next.has(trackerId)) {
                                  next.delete(trackerId);
                                } else {
                                  next.add(trackerId);
                                }
                                return next;
                              });
                            }}
                          >
                            <td style={{ ...td, textAlign: 'center', fontSize: 14 }}>
                              <span style={{ 
                                display: 'inline-block',
                                transition: 'transform 0.2s',
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              }}>
                                ▶
                              </span>
                            </td>
                            <td style={td}>{g.vendor}</td>
                            <td style={td}>{g.event}</td>
                            <td style={td}>
                              {g.firedCount > 0 ? (
                                <span style={{ color: 'var(--ok, #22c55e)', fontWeight: 600 }}>
                                  {g.firedCount}/{g.count} fired
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-secondary, #6b7280)' }}>
                                  {g.count} pending
                                </span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && g.urls.map((url, urlIdx) => (
                            <tr key={`${i}-url-${urlIdx}`} style={{ background: 'var(--surface-2, #f9fafb)' }}>
                              <td style={td}></td>
                              <td style={{ ...td, paddingLeft: 20 }} colSpan={3}>
                                <div style={{ 
                                  fontFamily: 'monospace', 
                                  fontSize: 11,
                                  wordBreak: 'break-all',
                                  color: 'var(--text-secondary, #6b7280)',
                                  padding: '4px 8px',
                                  background: 'var(--surface, #fff)',
                                  border: '1px solid var(--border, #e5e7eb)',
                                  borderRadius: 4,
                                  margin: '4px 0',
                                }}>
                                  {url}
                                </div>
                              </td>
                            </tr>
                          ))}
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
