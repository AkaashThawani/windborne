export const TabPanel = ({ tabs, activeTab, onChange, children }) => (
  <div className="h-full flex flex-col">
    <div className="flex border-b border-gray-200 overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === tab.id
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
    <div className="flex-1 overflow-y-auto p-4">
      {children}
    </div>
  </div>
);
