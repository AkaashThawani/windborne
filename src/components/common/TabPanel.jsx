import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const TabPanel = ({ tabs, activeTab, onChange, children }) => (
  <div className="h-full flex flex-col">
    <Tabs value={activeTab} onValueChange={onChange} className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-3">
        {tabs.map(tab => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={activeTab} className="flex-1 overflow-y-auto p-6 mt-6 min-h-0">
        {children}
      </TabsContent>
    </Tabs>
  </div>
);
