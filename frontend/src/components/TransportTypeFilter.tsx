'use client';

import { useState } from 'react';

export type TransportType = 'all' | 'nahverkehr' | 'fernverkehr';

interface TransportTypeFilterProps {
  value: TransportType;
  onChange: (value: TransportType) => void;
}

export default function TransportTypeFilter({ value, onChange }: TransportTypeFilterProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <label className="text-sm font-medium text-gray-700">Verkehrstyp:</label>
      <div className="flex gap-2">
        <button
          onClick={() => onChange('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Alle
        </button>
        <button
          onClick={() => onChange('nahverkehr')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === 'nahverkehr'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🚇 Nahverkehr
          <span className="ml-2 text-xs opacity-75">(U-Bahn, Tram, Bus)</span>
        </button>
        <button
          onClick={() => onChange('fernverkehr')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === 'fernverkehr'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🚆 Fernverkehr
          <span className="ml-2 text-xs opacity-75">(S-Bahn, REX, RJ)</span>
        </button>
      </div>
    </div>
  );
}
