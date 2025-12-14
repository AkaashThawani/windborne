export const StatCard = ({ label, value, percentage, icon }) => (
  <div className="text-center p-3 bg-gray-50 rounded-lg">
    {icon && <div className="text-2xl mb-1">{icon}</div>}
    <div className="text-2xl font-bold text-indigo-600">{value}</div>
    <div className="text-xs text-gray-600 uppercase tracking-wide">{label}</div>
    {percentage && (
      <div className="text-xs text-gray-500 mt-1">({percentage}%)</div>
    )}
  </div>
);
