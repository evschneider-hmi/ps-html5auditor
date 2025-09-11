export interface Allowlists {
  hosts: Set<string>;
  filetypes: Set<string>; // lowercase with leading dot
}

export function buildAllowlists(hosts: string[], filetypes: string[]): Allowlists {
  return { hosts: new Set(hosts.map(h => h.toLowerCase())), filetypes: new Set(filetypes.map(f => f.toLowerCase())) };
}
