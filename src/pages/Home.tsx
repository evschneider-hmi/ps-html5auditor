import React from 'react';
import { DropZone } from '../components/DropZone';
import { ResultsTable } from '../components/ResultsTable';

export default function Home(){
  return (
    <div className="p-4">
  <h1 className="text-lg font-bold">HTML5 Creative Auditor</h1>
  <p className="text-xs text-gray-600 mb-4">From Horizon Media’s Platform Solutions team</p>
      <DropZone />
      <ResultsTable />
    </div>
  );
}
