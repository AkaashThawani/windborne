export const Card = ({ title, children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
    {title && (
      <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">
        {title}
      </h3>
    )}
    <div className="text-gray-700">{children}</div>
  </div>
);
