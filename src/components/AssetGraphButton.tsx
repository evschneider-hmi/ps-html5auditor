import React from 'react';
export const AssetGraphButton: React.FC<{ disabled?: boolean; onClick?: () => void; }> = ({ disabled, onClick }) => {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40">Graph</button>
  );
};
