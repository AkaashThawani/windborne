import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const TabPanel = ({ tabs, activeTab, onChange, children, size = "default" }) => {
  const isViewTabs = !children; // View tabs don't have children

  if (isViewTabs) {
    // Simple tab list for mode switching (no content areas)
    return (
      <Tabs value={activeTab} onValueChange={onChange}>
        <TabsList className={`grid w-full ${size === 'sm' ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  }

  // Full tab panel with content areas
  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={onChange} className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={activeTab} className="flex-1 overflow-y-auto min-h-0">
          {children}
        </TabsContent>
      </Tabs>
    </div>
  );
};
