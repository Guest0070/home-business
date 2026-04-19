import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default function Reports() {
  const [tab, setTab] = useState('trip-profit');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api(`/reports/${tab}`).then(setRows).catch(console.error);
  }, [tab]);

  const columns = {
    'trip-profit': [
      { key: 'trip_date', label: 'Date' },
      { key: 'lr_number', label: 'LR' },
      { key: 'vehicle_no', label: 'Truck' },
      { key: 'driver_name', label: 'Driver' },
      { key: 'freight', label: 'Freight', render: (r) => money(r.freight) },
      { key: 'total_expense', label: 'Expense', render: (r) => money(r.total_expense) },
      { key: 'profit', label: 'Profit', render: (r) => money(r.profit) }
    ],
    'truck-profit': [
      { key: 'vehicle_no', label: 'Truck' },
      { key: 'ownership', label: 'Type' },
      { key: 'trips', label: 'Trips' },
      { key: 'distance_km', label: 'KM' },
      { key: 'profit', label: 'Profit', render: (r) => money(r.profit) }
    ],
    'driver-performance': [
      { key: 'driver_name', label: 'Driver' },
      { key: 'total_trips', label: 'Trips' },
      { key: 'total_profit', label: 'Profit', render: (r) => money(r.total_profit) },
      { key: 'average_profit', label: 'Avg Profit', render: (r) => money(r.average_profit) },
      { key: 'mileage', label: 'Mileage' },
      { key: 'abnormal_diesel_trips', label: 'Diesel Flags' }
    ],
    'diesel-usage': [
      { key: 'trip_date', label: 'Date' },
      { key: 'lr_number', label: 'LR' },
      { key: 'vehicle_no', label: 'Truck' },
      { key: 'driver_name', label: 'Driver' },
      { key: 'diesel_litres', label: 'Diesel' },
      { key: 'mileage', label: 'Mileage' },
      { key: 'abnormal_diesel', label: 'Flag', render: (r) => r.abnormal_diesel ? 'Abnormal' : 'OK' }
    ]
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Object.keys(columns).map((key) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'btn-primary' : 'btn-muted'}>
            {key.replace('-', ' ')}
          </button>
        ))}
      </div>
      <DataTable rows={rows} columns={columns[tab]} />
    </div>
  );
}

